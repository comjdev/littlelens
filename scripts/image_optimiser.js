// scripts/webp_generator.js (or similar name)

const { existsSync, promises: fs } = require("fs");
const path = require("path");
const sharp = require("sharp"); // Ensure sharp is installed: npm install sharp --save
const cheerio = require("cheerio"); // Ensure cheerio is installed: npm install cheerio-save

// Helper function to recursively get files (handles async iteration)
async function* getFiles(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const res = path.resolve(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules and .git directories for performance/safety
        if (entry.name === "node_modules" || entry.name === ".git") {
          continue;
        }
        yield* getFiles(res); // Recurse into subdirectory
      } else {
        yield res; // Yield file path
      }
    }
  } catch (error) {
    // Log directory read errors but don't stop the generator
    console.error(`Error reading directory ${dir}: ${error.message}`);
  }
}

// --- Hexo Event Handler ---
// Use the 'exit' hook which you confirmed is executing after generation
hexo.on("exit", async function () {
  const log = this.log; // Hexo's logger
  const publicDir = this.public_dir; // Path to the generated public folder
  // Get custom configuration from _config.yml
  const config = this.config.image_optimiser || {}; // Get custom config

  log.info("Starting Image Optimization, WebP generation, and HTML update...");

  // --- COUNTER VARIABLES - Declared OUTSIDE try block ---
  let processedImagesCount = 0;
  let erroredImagesCount = 0;
  let processedHtmlCount = 0;
  let updatedImgTagsCount = 0;
  // --- END COUNTER VARIABLES ---

  try {
    // Add logs immediately after variable assignments
    // ... (initial variable assignment logs) ...

    // Configure quality settings
    const jpegQuality = config.jpegQuality || 80;
    const pngQuality = config.pngQuality || 80;
    const webpQuality = config.webpQuality || 80;
    // Supported original extensions (lowercase) - excluding GIF
    const supportedImageExtensions = (
      config.imageExtensions || [".jpg", ".jpeg", ".png"]
    ).map((ext) => ext.toLowerCase());
    const htmlExtensions = [".html"]; // We only process .html files
    const stripMetadata = config.stripMetadata !== false; // Default to true

    // Ensure the public directory exists before attempting to read it
    if (!existsSync(publicDir)) {
      log.error(
        `Image processing and HTML update skipped: Public directory not found at ${publicDir}`
      );
      return; // Exit the handler if public is missing
    }
    log.info(`Searching for files in public directory: ${publicDir}`);

    // --- Iterate through all files in the public directory ---
    for await (const filePath of getFiles(publicDir)) {
      const ext = path.extname(filePath).toLowerCase();
      const relativeFilePath = path.relative(publicDir, filePath);

      // *** ENSURE dirName AND baseName ARE DECLARED HERE FOR EACH FILE ***
      const dirName = path.dirname(filePath);
      const baseName = path.basename(filePath, ext);
      // **************************************************************

      // --- Process HTML Files ---
      if (htmlExtensions.includes(ext)) {
        // log.debug(`Processing HTML file: ${relativeFilePath}`);
        try {
          const htmlContent = await fs.readFile(filePath, "utf8");
          const $ = cheerio.load(htmlContent);
          let htmlModified = false;

          // Find all <img> tags that are not already inside a <picture> tag
          $("img:not(picture img)").each((i, el) => {
            const $img = $(el);
            const imgSrc = $img.attr("src");

            // Skip if no src, is a data URL, or is an external URL
            if (
              !imgSrc ||
              imgSrc.startsWith("data:") ||
              imgSrc.startsWith("http") ||
              imgSrc.startsWith("//")
            ) {
              // log.debug(`Skipping non-local or data URI img: ${imgSrc} in ${relativeFilePath}`);
              return; // Skip to the next img tag
            }

            // Resolve the image source path relative to the public directory root
            // This handles '/', '../', and './' paths correctly
            const imgFilePathRelativeToPublic = path.join(
              path.dirname(relativeFilePath),
              imgSrc
            );
            const originalImagePathFull = path.join(
              publicDir,
              imgFilePathRelativeToPublic
            );

            const originalImgExt = path
              .extname(originalImagePathFull)
              .toLowerCase();

            // Check if the original image has a supported extension for WebP conversion
            if (!supportedImageExtensions.includes(originalImgExt)) {
              // log.debug(`Skipping img with unsupported original format: ${originalImgExt} for ${imgSrc} in ${relativeFilePath}`);
              return; // Skip to the next img tag
            }

            // Calculate the path to the potential WebP version
            const webpPathFull = originalImagePathFull.replace(
              /\.(jpg|jpeg|png)$/i,
              ".webp"
            );

            // Check if the WebP version actually exists
            if (existsSync(webpPathFull)) {
              // Calculate the relative path from the current HTML file's directory to the WebP file
              const webpSrcRelative = path.relative(
                path.dirname(filePath),
                webpPathFull
              );
              // Calculate the relative path from the current HTML file's directory to the original image
              const originalSrcRelative = path.relative(
                path.dirname(filePath),
                originalImagePathFull
              );

              // Create the <picture> element
              const $picture = $("<picture></picture>");

              // Add the <source> tag for WebP
              const $source = $("<source>")
                .attr("srcset", webpSrcRelative)
                .attr("type", "image/webp");
              // Copy srcset/sizes from original img to source if they exist
              if ($img.attr("srcset"))
                $source.attr(
                  "srcset",
                  $img
                    .attr("srcset")
                    .replace(new RegExp(originalImgExt + "$", "gi"), ".webp")
                ); // Adjust srcset for webp
              if ($img.attr("sizes")) $source.attr("sizes", $img.attr("sizes"));

              $picture.append($source);

              // Clone the original <img> tag and add it as the fallback
              const $fallbackImg = $img.clone();
              // Ensure the fallback img src is correct (might need to re-calculate relative path)
              $fallbackImg.attr("src", originalSrcRelative); // Use the relative path to the original

              // Preserve other attributes from the original img tag on the fallback
              // https://stackoverflow.com/a/12274895/1234567 (adapted for cheerio)
              const attributes = {};
              for (const attrName in $img.attr()) {
                if (
                  attrName !== "src" &&
                  attrName !== "srcset" &&
                  attrName !== "sizes"
                ) {
                  // Don't re-copy src/srcset/sizes
                  attributes[attrName] = $img.attr()[attrName];
                }
              }
              $fallbackImg.attr(attributes);

              $picture.append($fallbackImg);

              // Replace the original <img> with the new <picture> element
              $img.replaceWith($picture);
              htmlModified = true;
              updatedImgTagsCount++;
              // log.debug(`Replaced <img> with <picture> for ${imgSrc} in ${relativeFilePath}`);
            } else {
              // log.debug(`No WebP found for ${imgSrc} (looked for ${path.relative(publicDir, webpPathFull)}) in ${relativeFilePath}`);
            }
          });

          // If the HTML was modified, write the changes back to the file
          if (htmlModified) {
            // Use $.html() to get the modified HTML string
            const modifiedHtmlContent = $.html();
            await fs.writeFile(filePath, modifiedHtmlContent, "utf8");
            log.info(`Updated images in HTML file: ${relativeFilePath}`);
            processedHtmlCount++;
          }
        } catch (htmlProcessError) {
          console.error(
            `Error processing HTML file ${relativeFilePath}: ${htmlProcessError.message}`
          );
          log.error(
            `Error processing HTML file ${relativeFilePath}: ${htmlProcessError.message}`
          );
          // Error occurred, counter already incremented implicitly by loop structure if needed
        }
      } // --- End HTML File Processing ---

      // --- Process Image Files (Optimize and Create WebP) ---
      else if (supportedImageExtensions.includes(ext)) {
        // Check if it's a supported image type (JPG, PNG)

        // Skip if it's already a webp (should be handled by extension check, but robust)
        if (ext === ".webp") continue; // Should not be reached if supportedExtensions is correct

        try {
          // Read the original file into a buffer
          // log.debug(`Reading original file: ${relativeFilePath}`);
          const originalBuffer = await fs.readFile(filePath);

          const imageFromBuffer = sharp(originalBuffer); // Create sharp instance from buffer
          const metadata = await imageFromBuffer.metadata(); // Get metadata to determine format

          // --- Apply Optimization based on format (to buffer) ---
          let optimizedBuffer;
          let sharpPipeline = imageFromBuffer.clone(); // Clone to allow multiple operations from original buffer

          if (stripMetadata) {
            sharpPipeline = sharpPipeline.withMetadata(false);
          } else {
            sharpPipeline = sharpPipeline.keepMetadata();
          }

          if (metadata.format === "jpeg") {
            log.info(`Optimizing JPG: ${relativeFilePath}`);
            optimizedBuffer = await sharpPipeline
              .jpeg({ quality: jpegQuality, progressive: true }) // progressive often good for web JPEGs
              .toBuffer();
          } else if (metadata.format === "png") {
            log.info(`Optimizing PNG: ${relativeFilePath}`);
            optimizedBuffer = await sharpPipeline
              .png({ quality: pngQuality, compressionLevel: 6 }) // compressionLevel 6 is a good balance
              .toBuffer();
          } else {
            // Should not happen if supportedExtensions is correct based on file extension check
            log.warn(
              `Skipping optimization for unexpected format: ${metadata.format} for ${relativeFilePath}`
            );
            // Error occurred, but not critical
            erroredImagesCount++; // Increment error count for this file
            continue; // Skip this file if format is unexpected
          }

          // --- Overwrite the original file with the optimized buffer ---
          // log.debug(`Overwriting original file: ${relativeFilePath} (Old size: ${metadata.size})`);
          await fs.writeFile(filePath, optimizedBuffer);
          log.info(
            `Optimized original: ${relativeFilePath} (New size: ${optimizedBuffer.length})`
          );

          // --- Create the WebP version from the *optimized* buffer ---
          // log.debug(`Creating WebP from optimized buffer for: ${relativeFilePath}`);
          const webpBuffer = await sharp(optimizedBuffer) // Use the optimized buffer as source
            .webp({ quality: webpQuality })
            .toBuffer();

          // --- Save the WebP buffer to the new webp path ---
          const webpPath = path.join(dirName, baseName + ".webp"); // Calculate webp path again
          // log.debug(`Saving WebP file: ${path.relative(publicDir, webpPath)} (Size: ${webpBuffer.length})`);
          await fs.writeFile(webpPath, webpBuffer);
          log.info(
            `Generated WebP for: ${path.relative(publicDir, webpPath)} (Size: ${
              webpBuffer.length
            })`
          );

          processedImagesCount++; // Increment success count
        } catch (processError) {
          // Catch errors specific to processing this file
          console.error(
            `Error processing image file ${relativeFilePath}: ${processError.message}`
          );
          log.error(
            `Error processing image file ${relativeFilePath}: ${processError.message}`
          );
          erroredImagesCount++; // Increment error count for this file
        }
      } // --- End Image File Processing ---

      // --- Explicitly skip other file types (GIF, CSS, JS, etc.) ---
      else if (ext === ".gif") {
        // log.debug(`Skipping GIF file: ${relativeFilePath}`);
      } else if (ext === ".webp") {
        // log.debug(`Skipping already WebP file: ${relativeFilePath}`);
      }
      // else { log.debug(`Skipping file with extension: ${ext}`); } // Log all skipped types if needed
    } // End for await loop
    log.info("Finished file iteration loop.");
  } catch (handlerError) {
    // This catch block will log any errors happening OUTSIDE the file iteration loop
    // (e.g., error reading public directory, although check is above now)
    console.error("UNEXPECTED ERROR IN exit HANDLER:", handlerError);
    if (log && log.error) {
      log.error("FATAL ERROR in Image processing script:", handlerError);
    } else {
      console.error(
        "Hexo log not available, printing error again:",
        handlerError
      );
    }
  } finally {
    // This block runs whether there was an error or not
    log.info(
      `Image processing summary: Processed (Images): ${processedImagesCount}, Errored (Images): ${erroredImagesCount}.`
    );
    log.info(
      `HTML processing summary: Processed (HTML Files): ${processedHtmlCount}, Updated (Image Tags): ${updatedImgTagsCount}.`
    );
    log.info(`Overall processing finished.`); // Removed total errors log here
  }
});

// --- End Hexo Event Handler ---

// The getFiles function needs to be defined above the handler that uses it.
// ... (getFiles function code as shown at the very top) ...

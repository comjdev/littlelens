const cheerio = require("cheerio");

hexo.extend.helper.register("suburbContent", function (content, suburb) {
  if (typeof content !== "string") return content;

  const $ = cheerio.load(content);
  const targetHeading = `#${suburb.replace(
    /\s+/g,
    "-"
  )}-Childcare-Photographer`;

  let found = false;

  $("h2").each(function () {
    const headingText = $(this).text().trim();
    if (headingText === `${suburb} Childcare Photographer`) {
      found = true;
      const startElem = this;
      let next = $(this).next();
      const collected = [];

      // Traverse until the next heading
      while (next.length && !/^h[1-6]$/i.test(next[0].tagName)) {
        collected.push(next);
        next = next.next();
      }

      // Inject buttons before the next heading or at the end of content
      const buttonHTML = `
<div class="not-format flex flex-col gap-4 mt-4 mb-6 sm:flex-row">
					<a
						href="/childcare-photographer-melbourne/"
						class="sm:w-[275px] inline-flex w-full justify-center items-center px-5 py-3 text-base font-medium text-center text-white bg-little-lens-green-900 border rounded-lg shrink-0 focus:outline-none hover:text-little-lens-green-100 hover:bg-little-lens-green-800"
						role="button"
					>
						Info for Childcares/Kindergartens
					</a>
					<a
						href="/families-faqs/"
						class="sm:w-[275px] px-5 py-3 w-full text-base font-medium text-center text-white bg-little-lens-light-700 rounded-lg shrink-0 hover:bg-primary-800 hover:bg-little-lens-light-800"
						role="button"
					>
						Parents FAQs
					</a>
				</div>
`;

      if (next.length) {
        $(next).before(buttonHTML);
      } else {
        // No more headings — append to end of current section
        $(startElem).after(buttonHTML);
      }
    }
  });

  if (!found) {
    console.warn(`Heading "## ${suburb} Childcare Photographer" not found.`);
  }

  return $.html();
});

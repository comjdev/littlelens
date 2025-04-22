hexo.extend.helper.register("getFaqTitle", function (content) {
	// if (typeof content !== "string") return "";
	// const match = content.match(/^# (.+)$/m);
	// return match ? this.markdown(`# ${match[1]}`) : "";

	if (typeof content !== "string") return "";

	const match = content.match(/^# (.+)$/m);
	if (match) {
		const title = match[1].trim();
		return `<h1 class="text-4xl font-extrabold text-gray-900 mb-6">${title}</h1>`;
	}
	return "";
});

hexo.extend.helper.register("getFaqIntro", function (content) {
	if (typeof content !== "string") return "";

	const lines = content.split("\n");
	const introLines = [];

	for (const line of lines) {
		if (line.trim().startsWith("## ")) break; // Stop at the first H2
		if (line.trim() && !line.trim().startsWith("#")) {
			introLines.push(line.trim());
		}
	}

	const html = introLines
		.map(
			(line) =>
				`<p class="mb-3 font-light text-gray-500 sm:text-xl">${line}</p>`,
		)
		.join("\n");

	return html;
});

hexo.extend.helper.register("renderFaqs", function (content, maxItems) {
	// --- Input Validation ---
	// Ensure content is a string, default to empty string if not
	const sourceContent = typeof content === "string" ? content : "";
	// Check if maxItems is a valid positive number
	const limitItems = typeof maxItems === "number" && maxItems > 0;
	const numItemsToRender = limitItems ? maxItems : Infinity; // Use Infinity if not limiting

	// --- FAQ Parsing ---
	const faqs = [];
	const lines = sourceContent.split("\n");
	let current = null;

	lines.forEach((line) => {
		const trimmedLine = line.trim();
		if (trimmedLine.startsWith("### ")) {
			if (current) faqs.push(current);
			current = {
				question: trimmedLine.replace("### ", "").trim(),
				answer: "",
			};
		} else if (current && trimmedLine.length > 0) {
			current.answer += line + "\n";
		} else if (
			current &&
			line.length === 0 &&
			current.answer.length > 0 &&
			!current.answer.endsWith("\n\n")
		) {
			current.answer += "\n";
		}
	});
	if (current) faqs.push(current);

	// --- Item Limiting ---
	// Slice the array if limiting, otherwise use the whole array
	// slice(0, Infinity) correctly returns the whole array
	const itemsToProcess = faqs.slice(0, numItemsToRender);

	// --- Column Splitting ---
	// Split the itemsToProcess array (which is either limited or full)
	const left = itemsToProcess.filter((_, i) => i % 2 === 0);
	const right = itemsToProcess.filter((_, i) => i % 2 === 1);

	// --- Column Rendering ---
	const renderColumn = (items) => {
		return items
			.map(
				(item) => `
          <div class="mb-10">
            <h3 class="flex items-center mb-4 text-lg font-medium text-gray-900 ">
              <svg class="flex-shrink-0 mr-2 w-5 h-5 text-little-lens-green-700" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>
              ${item.question}
            </h3>
            ${this.markdown(item.answer.trim())}
          </div>
		`,
			)
			.join("");
	};

	// --- Final HTML Output ---
	// Returns empty divs if no FAQs are processed
	return `
      <div>${renderColumn(left)}</div>
      <div>${renderColumn(right)}</div>
    `;
});

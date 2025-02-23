const fs = require("fs");
const path = require("path");

hexo.extend.helper.register("getSvg", function (filePath) {
	const svgPath = path.join(hexo.theme_dir, "source", filePath);
	return fs.readFileSync(svgPath, "utf8");
});

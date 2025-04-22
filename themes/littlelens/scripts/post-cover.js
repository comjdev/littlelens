hexo.extend.helper.register("postCover", function (post, defaultCover = null) {
	if (!post || !post.cover) {
		return defaultCover ? this.url_for(defaultCover) : "";
	}

	// Remove index.html if present in the path
	const basePath = post.path.replace(/index\.html$/, "");
	return this.url_for(basePath + post.cover);
});

hexo.extend.helper.register("jsonld", function (page, site, config) {
	const isSuburbPage = page.layout === "suburb";

	const areaServed = isSuburbPage
		? {
				"@type": "Place",
				name: `${page.suburb}, VIC`,
		  }
		: site.pages
				.filter((p) => p.layout === "suburb")
				.map((p) => ({
					"@type": "Place",
					name: `${p.suburb}, VIC`,
				}));

	const json = {
		"@context": "https://schema.org",
		"@type": "LocalBusiness",
		name: "Little Lens - Childcare Photography Melbourne",
		telephone: "+61 403 188 674",
		image: `${config.url}/img/logos/logo.png`,
		url: page.path ? `${config.url}/${page.path}` : config.url,
		address: {
			"@type": "PostalAddress",
			addressLocality: "Boronia",
			addressRegion: "VIC",
			postalCode: "3155",
			addressCountry: "AU",
		},
		description: isSuburbPage
			? `Childcare photography services in ${page.suburb} and surrounding areas.`
			: page.description,
		areaServed: areaServed,
		geo: {
			"@type": "GeoCoordinates",
			latitude: page.latitude || -37.8781,
			longitude: page.longitude || 145.1669,
		},
		openingHours: "Mo,Tu,We,Th,Fr 09:00-17:00",
		contactPoint: {
			"@type": "ContactPoint",
			telephone: "+61 403 188 674",
			contactType: "Customer Service",
			areaServed: "AU",
			availableLanguage: "English",
		},
	};

	return JSON.stringify(json, null, 2);
});
// This code generates JSON-LD structured data for a local business, specifically for a childcare photography service in Melbourne.
// It includes information such as the business name, contact details, address, description, area served, and geographical coordinates.
// The JSON-LD data is generated based on the page layout and is intended to improve SEO and provide structured information to search engines.
// The code uses Hexo's helper function to register a new helper called 'jsonld'.
// The generated JSON-LD data can be included in the HTML of the page to enhance its visibility in search engine results.
// The code also handles different layouts for suburb pages and includes relevant details based on the page context.
// The JSON-LD data is structured according to schema.org standards, making it compatible with search engines like Google.

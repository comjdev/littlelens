hexo.extend.helper.register("jsonld", function (page, site, config) {
  const isSuburbPage = page.layout === "suburb";

  const areaServed = isSuburbPage
    ? {
        "@type": "Place",
        name: `${page.suburb}, VIC`,
      }
    : [
        ...site.pages
          .filter((p) => p.layout === "suburb")
          .map((p) => ({
            "@type": "Place",
            name: `${p.suburb}, VIC`,
          })),
      ];

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
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "08:30",
        closes: "16:30",
      },
    ],
    priceRange: "$$",
    description:
      "Professional photography services for childcare centres, kindergartens, and early learning centres in Melbourne's Eastern and Southern suburbs.",
    aggregateRating: {
      // Optional: If you have reviews marked up
      "@type": "AggregateRating",
      ratingValue: "5", // Your average rating
      reviewCount: "17", // Total number of reviews
      bestRating: "5",
      worstRating: "1",
    },
    makesOffer: {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "Childcare Photography",
        serviceType: "Photography",
        description:
          "Professional photography services for childcare centres, kindergartens, and early learning centres.",
      },
    },
  };

  return JSON.stringify(json, null, 2);
});

hexo.extend.helper.register("faqJsonld", function (page) {
  const sourceContent = typeof page._content === "string" ? page._content : "";

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

  if (!faqs.length) return "";

  // --- Build FAQPage JSON-LD ---
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: this.strip_html(faq.answer.trim()).replace(/\s+/g, " "),
      },
    })),
  };

  return JSON.stringify(jsonLd, null, 2);
});

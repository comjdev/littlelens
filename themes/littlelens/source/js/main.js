// ——————————————————————————————————————————————————
// Navigation
// ——————————————————————————————————————————————————

document.addEventListener("DOMContentLoaded", () => {
	const hamburger = document.querySelector("#hamburger");
	const nav = document.querySelector("#nav");
	const navLi = document.querySelectorAll("#nav > li");
	hamburger.addEventListener("click", () => {
		hamburger.classList.toggle("mobile-hamburger");
		nav.classList.toggle("show-nav");
	});
	navLi.forEach((li) => {
		li.addEventListener("click", () => {
			nav.classList.remove("show-nav");
			hamburger.classList.remove("mobile-hamburger");
		});
	});
});

// ——————————————————————————————————————————————————
// Socials
// ——————————————————————————————————————————————————

document.addEventListener("DOMContentLoaded", function () {
	const btn = document.getElementById("copy-link-btn");

	if (btn) {
		btn.addEventListener("click", function () {
			const url = btn.getAttribute("data-url");
			navigator.clipboard
				.writeText(url)
				.then(() => {})
				.catch((err) => {
					console.error("Failed to copy link:", err);
				});
		});
	}
});

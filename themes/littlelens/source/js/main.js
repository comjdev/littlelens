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

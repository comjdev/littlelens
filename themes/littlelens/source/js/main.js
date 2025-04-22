// import Swiper JS

// document.addEventListener("DOMContentLoaded", function () {
// 	// Swiper
// 	const swiper = new Swiper(".swiper", {
// 		loop: true,
// 		centeredSlides: true,
// 		slidesPerView: "auto",
// 		spaceBetween: 4,
// 		autoplay: {
// 			delay: 2000,
// 		},
// 		speed: 2000,
// 	});
// });

// Send email
// document
// 	.getElementById("contactForm")
// 	.addEventListener("submit", async function (e) {
// 		e.preventDefault();

// 		const formData = {
// 			name: document.getElementById("name").value,
// 			company: document.getElementById("company").value,
// 			location: document.getElementById("location").value,
// 			email: document.getElementById("email").value,
// 			message: document.getElementById("message").value,
// 		};

// 		try {
// 			const response = await fetch("YOUR_API_GATEWAY_URL", {
// 				method: "POST",
// 				headers: {
// 					"Content-Type": "application/json",
// 				},
// 				body: JSON.stringify(formData),
// 			});

// 			const result = await response.json();
// 			alert(result.message || "Message sent successfully!");
// 		} catch (error) {
// 			console.error("Error sending message:", error);
// 			alert("Failed to send message. Please try again later.");
// 		}

// 		// Open modal
// 		// document.getElementById("successEmail").classList.add("is-active");
// 		document.getElementById("successEmail").classList.remove("hidden");

// 		// Reset form
// 		document.getElementById("contactForm").reset();
// 	});

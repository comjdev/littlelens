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

// ——————————————————————————————————————————————————
// Contact
// ——————————————————————————————————————————————————
document.addEventListener("DOMContentLoaded", function () {
  const childcareBtn = document.getElementById("childcare-center-btn");
  const generalBtn = document.getElementById("general-btn");

  const bookingEnquiry = document.getElementById("booking-enquiry");
  const generalContact = document.getElementById("general-contact");

  if (childcareBtn) {
    childcareBtn.addEventListener("click", function () {
      bookingEnquiry.classList.remove("hidden");
      generalContact.classList.add("hidden");
    });
  }

  if (generalBtn) {
    generalBtn.addEventListener("click", function () {
      bookingEnquiry.classList.add("hidden");
      generalContact.classList.remove("hidden");
    });
  }
});

document.addEventListener("DOMContentLoaded", function () {
  var user = "hello"; // Replace with the part before the @
  var domain = "littlelens.com.au"; // Replace with the part after the @
  var email = user + "@" + domain;
  var emailLink = document.createElement("a");
  emailLink.href = "mailto:" + email;
  emailLink.textContent = email;
  const emailField = document.getElementById("emailAddress");
  if (emailField) {
    emailField.appendChild(emailLink);
  }
});

// ——————————————————————————————————————————————————
// Contact form
// ——————————————————————————————————————————————————

document.addEventListener("DOMContentLoaded", function () {
  // Get both forms individually
  var contactForm = document.getElementById("contactForm");
  var bookingEnquiryForm = document.getElementById("bookingEnquiryForm");

  var loadingStatus = document.getElementById("formLoading");
  var formSuccess = document.getElementById("formSuccess");
  var errorStatus = document.getElementById("formError");

  // Ensure the status messages are hidden initially
  if (loadingStatus) loadingStatus.classList.add("hidden");
  if (formSuccess) formSuccess.classList.add("hidden");
  if (errorStatus) errorStatus.classList.add("hidden");

  async function handleSubmit(event) {
    event.preventDefault();

    // Determine which form was submitted
    const submittedForm = event.target;

    if (loadingStatus) loadingStatus.classList.remove("hidden");
    if (formSuccess) formSuccess.classList.add("hidden");
    if (errorStatus) errorStatus.classList.add("hidden");

    var formData = new FormData(submittedForm);

    fetch(submittedForm.action, {
      method: submittedForm.method,
      body: formData,
      headers: {
        Accept: "application/json",
      },
    })
      .then((response) => {
        if (response.ok) {
          if (loadingStatus) loadingStatus.classList.add("hidden");
          if (formSuccess) formSuccess.classList.remove("hidden");
          if (errorStatus) errorStatus.classList.add("hidden");
          submittedForm.reset(); // Reset the specific form that was submitted
        } else {
          response.json().then((data) => {
            if (loadingStatus) loadingStatus.classList.add("hidden");
            if (formSuccess) formSuccess.classList.add("hidden");
            if (errorStatus) errorStatus.classList.remove("hidden");

            // You might want to display errors specific to the submitted form
            const errors = data["errors"]
              .map((error) => error["message"])
              .join(", ");
            console.error("Form submission errors: ", errors); // Use console.error for errors
            // Consider displaying these errors to the user near the relevant form
          });
        }
      })
      .catch((error) => {
        if (loadingStatus) loadingStatus.classList.add("hidden");
        if (formSuccess) formSuccess.classList.add("hidden");
        if (errorStatus) errorStatus.classList.remove("hidden");
        console.error("Form submission failed: ", error); // Use console.error
        // Display a generic error message to the user
      });
  }

  // Attach the event listener to both forms if they exist
  if (contactForm) {
    contactForm.addEventListener("submit", handleSubmit);
  }

  if (bookingEnquiryForm) {
    bookingEnquiryForm.addEventListener("submit", handleSubmit);
  }
});

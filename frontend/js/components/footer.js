import { BRAND, PATHS } from '../core/config.js';
import { esc } from '../core/ui.js';

export function renderFooter() {
  const year = new Date().getFullYear();
  return `<footer class="site-footer">
    <div class="container-xxl">
      <div class="row g-4">
        <div class="col-lg-5">
          <a class="brand" href="${PATHS.home}"><span class="brand-mark" aria-hidden="true"></span><span>${esc(BRAND.name)}</span></a>
          <p class="mt-3 footer-note">Find a doctor, book a visit and keep your reports and prescriptions in one private place.</p>
          <p class="footer-emergency"><i class="fa-solid fa-truck-medical me-2" aria-hidden="true"></i>In an emergency, call 108 or open the <a href="${PATHS.emergency}">emergency page</a>.</p>
        </div>
        <div class="col-6 col-lg-3">
          <h2 class="footer-title">For patients</h2>
          <ul class="footer-links">
            <li><a href="${PATHS.findDoctor}">Find a doctor</a></li>
            <li><a href="${PATHS.packages}">Health packages</a></li>
            <li><a href="${PATHS.teleconsultation}">Teleconsultation</a></li>
            <li><a href="${PATHS.faq}">Help and FAQ</a></li>
          </ul>
        </div>
        <div class="col-6 col-lg-4">
          <h2 class="footer-title">Information</h2>
          <ul class="footer-links">
            <li><a href="${PATHS.about}">About</a></li>
            <li><a href="${PATHS.contact}">Contact</a></li>
            <li><a href="${PATHS.privacy}">Privacy policy</a></li>
            <li><a href="${PATHS.terms}">Terms and conditions</a></li>
            <li><a href="${PATHS.disclaimer}">Medical disclaimer</a></li>
          </ul>
        </div>
      </div>
      <p class="footer-legal">&copy; ${year} ${esc(BRAND.name)}. This is a demonstration project for learning. It is not a real medical service, and no real patient data is used.</p>
    </div>
  </footer>`;
}

import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";
import FarmRegisterForm from "./FarmRegisterForm";
import "./farm-register.css";

export const metadata = {
  title: "Register Your Farm | SAGANA",
  description:
    "Partner with SAGANA to showcase your fruit farm and accept online visit reservations.",
};

export default function FarmRegisterPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="registration-container">
        <header className="page-title-banner">
          <h1>Register Your Farm on SAGANA</h1>
          <p>
            Fill out the details below to feature your agritourism destination
            on our platform.
          </p>
        </header>

        <FarmRegisterForm />
      </main>
      <SiteFooter />
    </>
  );
}
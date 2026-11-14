import SiteHeader from "../../components/SiteHeader";
import FarmRegisterForm from "./FarmRegisterForm";
import styles from "../../reservation/reservation.module.css";

export const metadata = {
    title: "Register Your Farm | SAGANA",
    description:
        "Partner with SAGANA to showcase your fruit farm and accept online visit reservations.",
};

export default function FarmRegisterPage() {
    return (
        <div className={styles.site}>
        <SiteHeader />
        <main className={styles.main}>
            <FarmRegisterForm />
        </main>
        </div>
    );
}
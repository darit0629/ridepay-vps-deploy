import { useEffect } from "react";
import { useNavigate } from "react-router";

// A single, role-agnostic link (e.g. from a legal page or Settings) that
// always lands on the right role's real Help & Support screen — the actual
// FAQ/Report Issue/Safety/Contact/About list lives there, not duplicated here.
export default function HelpCenter() {
  const navigate = useNavigate();

  useEffect(() => {
    const role = localStorage.getItem("userRole");
    navigate(role === "driver" ? "/driver/support" : "/user/support", { replace: true });
  }, [navigate]);

  return null;
}

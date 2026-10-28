import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { nativeStartPath } from "@/lib/native-entry";

export default function NativeEntry() {
  const consumed = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (consumed.current) return;
    consumed.current = true;
    const target = nativeStartPath(Capacitor.isNativePlatform());
    if (target && location.pathname === "/") {
      navigate(`${target}${location.search}${location.hash}`, { replace: true });
    }
  }, [location, navigate]);
  return null;
}
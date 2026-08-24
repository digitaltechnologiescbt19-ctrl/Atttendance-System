import { useMemo } from "react";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface WelcomeBannerProps {
  name?: string;
}

export default function WelcomeBanner({ name = "Administrator" }: WelcomeBannerProps) {
  const greeting = useMemo(() => getGreeting(), []);
  const dateStr  = useMemo(() => formatDate(new Date()), []);

  return (
    <div className="welcome-banner">
      <div>
        <span className="welcome-greeting">{greeting},</span>
        <h2 className="welcome-name">Welcome back, {name}</h2>
        <p className="welcome-sub">Here's today's attendance overview.</p>
      </div>
      <div className="welcome-date">{dateStr}</div>
    </div>
  );
}

export function formatCurrency(amount) {
  const value = Number(amount) || 0;
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function formatPercent(value) {
  const num = Number(value) || 0;
  return `${Math.round(num)}%`;
}

export function greetingForHour(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export function firstName(fullName = "") {
  return fullName.split(" ")[0] || "Rep";
}

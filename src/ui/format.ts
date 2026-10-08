const currencyFormatter = new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const numberFormatter = new Intl.NumberFormat("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percentFormatter = new Intl.NumberFormat("da-DK", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signedFormatter = new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero" });
export const money = (x: number) => currencyFormatter.format(x);
export const moneyNumber = (x: number) => numberFormatter.format(x);
export const signedMoney = (x: number) => signedFormatter.format(x);
export const percent = (x: number | null | undefined) =>
  x == null
    ? "—"
    : percentFormatter.format(x);
export const amount = (x: number, maximumFractionDigits = 8) =>
  new Intl.NumberFormat("da-DK", { maximumFractionDigits }).format(x);
export const time = (s: string) =>
  s
    ? new Intl.DateTimeFormat("da-DK", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(s))
    : "Ikke bekræftet";
export function download(name: string, text: string) {
  const url = URL.createObjectURL(
      new Blob([text], { type: "application/json" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

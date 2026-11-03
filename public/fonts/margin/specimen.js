const sample = document.getElementById("sample");
const size = document.getElementById("size");
const output = document.getElementById("size-value");
sample.addEventListener("input", () => {
  for (const line of document.querySelectorAll(".sample"))
    line.textContent = sample.value;
});
size.addEventListener("input", () => {
  document.documentElement.style.setProperty(
    "--sample-size",
    `${size.value}px`,
  );
  output.value = `${size.value} px`;
});

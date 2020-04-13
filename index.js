const fs = require("fs").promises;
const path = require("path");
const puppeteer = require("puppeteer");
const mustache = require("mustache");

const generateHtml = async (invoice) => {
  const template = await fs.readFile("./template.html", "utf-8");
  const company = require("./company.json");

  if (company.logo) {
    company.name = await fs.readFile(company.logo, "utf-8");
  }

  const itemsWithTotal = decorateItemsWithTotal(invoice.items);

  const view = {
    company,
    invoice: {
      ...invoice,
      items: itemsWithTotal,
      total: calculateTotal(itemsWithTotal),
    },
    formatMoney,
  };

  return mustache.render(template, view);
};

const decorateItemsWithTotal = (items) =>
  items.map((item) => ({
    ...item,
    total: parseFloat(item.quantity.replace(/,/, ".")) * item.price,
  }));

const calculateTotal = (items) => {
  const exclVat = items.reduce((acc, item) => acc + item.total, 0);
  const vat = exclVat * 0.25;
  const inclVat = exclVat + vat;

  return { exclVat, vat, inclVat };
};

const formatMoney = () => (text, render) =>
  render(text).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " kr";

const generatePdf = async (invoice, outputFilename) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const html = await generateHtml(invoice);

  await page.setContent(html, { waitUntil: "networkidle0" });

  await page.pdf({
    path: outputFilename,
    format: "A4",
    margin: { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" },
  });

  await browser.close();
};

const main = async () => {
  try {
    const start = process.hrtime.bigint();
    const invoicePath = process.argv[2];
    const outputFilename = process.argv[3] || "invoice.pdf";

    if (!invoicePath) {
      throw new Error("An invoice JSON file is required");
    }

    const fileContents = await fs.readFile(invoicePath, "utf-8");
    const invoice = JSON.parse(fileContents);

    await generatePdf(invoice, outputFilename);

    const end = process.hrtime.bigint();
    const elapsed = (Number(end - start) / 1000000000).toFixed(4);

    console.log(
      `Successfully generated ${outputFilename} in ${elapsed} seconds`
    );
  } catch (err) {
    console.error(err.message);
  }
};

main();

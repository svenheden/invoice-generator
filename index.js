const fs = require('fs');
const path = require('path');
const express = require('express');
const cons = require('consolidate');

const app = express();

app.engine('html', cons.mustache);
app.set('view engine', 'html');
app.set('views', __dirname);
app.use(express.static(__dirname))

const company = require('./company.json');
const formatMoney = () => (text, render) => render(text).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' kr';

app.get('/', (req, res, next) => {
    const invoicesPath = path.join(__dirname, 'invoices');

    fs.readdir(invoicesPath, (err, files) => {
        const items = files
            .filter(file => /^[^\.]/.test(file))
            .map(file => file.replace(/.json/, ''))
            .map(invoiceId => `<li><a href="/${invoiceId}">${invoiceId}</a></li>`)
            .join('');

        res.send(`<ul>${items}</ul>`);
    });
});

app.get('/:invoiceId', (req, res, next) => {
    const invoiceId = req.params.invoiceId;
    const invoicePath = path.join(__dirname, 'invoices', invoiceId + '.json');

    fs.access(invoicePath, err => {
        if (err) {
            return next();
        }

        const invoice = require(invoicePath);
        invoice.items = decorateItemsWithTotal(invoice.items);
        invoice.total = calculateTotal(invoice.items);

        res.render('invoice', {
            company,
            invoice,
            title: `${invoiceId}`.padStart(3, '0'),
            formatMoney
        });
    });
});

app.listen(3000, () => console.log('Invoice generator listening on port 3000'));

const decorateItemsWithTotal = items => items.map(item => ({
    ...item,
    total: parseFloat(item.quantity) * item.price
}));

const calculateTotal = items => {
    const exclVat = items.reduce((acc, item) => acc + item.total, 0);
    const vat = exclVat * 0.25;
    const inclVat = exclVat + vat;

    return { exclVat, vat, inclVat };
}
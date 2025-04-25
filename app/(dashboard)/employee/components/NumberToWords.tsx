const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
    "Sixteen", "Seventeen", "Eighteen", "Nineteen"
];

const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
];

const getTwoDigitWords = (num: number): string => {
    if (num === 0) return "";
    if (num < 20) return ones[num];
    return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "");
};

const getThreeDigitWords = (num: number): string => {
    if (num === 0) return "";
    let word = "";
    if (Math.floor(num / 100) > 0) {
        word += ones[Math.floor(num / 100)] + " Hundred";
        if (num % 100 !== 0) word += " and ";
    }
    word += getTwoDigitWords(num % 100);
    return word;
};

const numberToWords = (num: number): string => {
    if (num === 0) return "Zero";
    if (num > 999999999) return "Overflow"; // limit to under 1000 crore

    const parts: string[] = [];

    const crore = Math.floor(num / 10000000);
    if (crore) parts.push(getTwoDigitWords(crore) + " Crore");

    num %= 10000000;
    const lakh = Math.floor(num / 100000);
    if (lakh) parts.push(getTwoDigitWords(lakh) + " Lakh");

    num %= 100000;
    const thousand = Math.floor(num / 1000);
    if (thousand) parts.push(getTwoDigitWords(thousand) + " Thousand");

    num %= 1000;
    const hundred = getThreeDigitWords(num);
    if (hundred) parts.push(hundred);

    return parts.join(" ").trim();
};

export default numberToWords;

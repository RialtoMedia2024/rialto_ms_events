module.exports = async function dateToString(date) {
    const options = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata', // Set the time zone to IST
    };
    return date.toLocaleString('en-IN', options);
  }
  
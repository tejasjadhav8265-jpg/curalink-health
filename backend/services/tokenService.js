const TokenCounter = require('../models/TokenCounter');
const { formatToken } = require('./slotRules');

// Next token number for a doctor on a date: 1, 2, 3 ... Atomic, so numbers never repeat.
async function nextToken(doctorId, date) {
  const run = () => TokenCounter.findOneAndUpdate(
    { doctor: doctorId, date }, { $inc: { seq: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  let counter;
  try { counter = await run(); } catch (err) {
    if (err.code !== 11000) throw err; // two first-ever requests raced to create the counter: just retry once
    counter = await run();
  }
  return { tokenSeq: counter.seq, tokenNumber: formatToken(counter.seq) };
}

module.exports = { nextToken };

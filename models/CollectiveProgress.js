const mongoose = require('mongoose');

const collectiveProgressSchema = new mongoose.Schema({
  womenHelped: {
    type: Number,
    required: [true, 'Women helped count is required'],
    default: 0,
    min: [0, 'Women helped count must be a positive number']
  }
}, {
  timestamps: true
});

// Ensure only one document exists
collectiveProgressSchema.statics.getOrCreate = async function() {
  let progress = await this.findOne();
  if (!progress) {
    progress = new this({ womenHelped: 0 });
    await progress.save();
  }
  return progress;
};

module.exports = mongoose.model('CollectiveProgress', collectiveProgressSchema);


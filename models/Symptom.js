const mongoose = require('mongoose');

const localizedTextSchema = new mongoose.Schema({
  en: {
    type: String,
    required: true,
    trim: true
  },
  de: {
    type: String,
    required: true,
    trim: true
  }
}, { _id: false });

const symptomSchema = new mongoose.Schema({
  slugKey: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  translations: {
    type: localizedTextSchema,
    required: true
  },
  category: {
    type: localizedTextSchema,
    required: true
  },
  image: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Symptom', symptomSchema);

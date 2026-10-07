const mongoose = require('mongoose');
const { ARTICLE_CATEGORIES } = require('../utils/constants');

const articleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    image: { type: String },
    category: { type: String, enum: ARTICLE_CATEGORIES, required: true, index: true },
    author: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    publishedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['published', 'draft'], default: 'published' },
  },
  { timestamps: true }
);

articleSchema.pre('validate', function makeSlug(next) {
  if (!this.slug && this.title) {
    this.slug = this.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  next();
});

module.exports = mongoose.model('Article', articleSchema);

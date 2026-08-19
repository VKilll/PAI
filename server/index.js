require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { initDatabase } = require('./database/db');

// Routes
const authRoutes = require('./routes/auth');
const packagesRoutes = require('./routes/packages');
const financeRoutes = require('./routes/finance');
const travelRoutes = require('./routes/travel');
const contentRoutes = require('./routes/content');
const briefingsRoutes = require('./routes/briefings');
const researchRoutes = require('./routes/research');
const statsRoutes = require('./routes/stats');
const engagementRoutes = require('./routes/engagement');
const influencersRoutes = require('./routes/influencers');
const collaborationsRoutes = require('./routes/collaborations');
const salesInvoicesRoutes = require('./routes/salesInvoices');
const influencerInvoicesRoutes = require('./routes/influencerInvoices');
const notificationsRoutes = require('./routes/notifications');
const portalMessagesRoutes = require('./routes/portalMessages');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Statische uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Database initialiseren
initDatabase();

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/packages', packagesRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/travel', travelRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/briefings', briefingsRoutes);
app.use('/api/research', researchRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/engagement', engagementRoutes);
app.use('/api/influencers', influencersRoutes);
app.use('/api/collaborations', collaborationsRoutes);
app.use('/api/sales-invoices', salesInvoicesRoutes);
app.use('/api/influencer-invoices', influencerInvoicesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/portal-messages', portalMessagesRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serveer React build (productie)
const clientBuild = path.join(__dirname, '..', 'client', 'build');
app.use(express.static(clientBuild));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuild, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Er is een serverfout opgetreden',
  });
});

app.listen(PORT, () => {
  console.log(`PA Atelier server draait op http://localhost:${PORT}`);
});

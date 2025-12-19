const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { createClient } = require('@supabase/supabase-js');
const orderHandler = require('./orderHandler');

class SessionManager {
    constructor() {
        this.sessions = new Map(); // Store active clients
        this.supabase = null;
    }

    initialize(supabaseUrl, supabaseKey) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    async startSession(establishmentId) {
        if (this.sessions.has(establishmentId)) {
            console.log(`Session already exists for ${establishmentId}`);
            return;
        }

        console.log(`Starting session for ${establishmentId}`);

        // Update status to 'initializing'
        await this.updateStatus(establishmentId, 'initializing', null);

        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: establishmentId,
                dataPath: './.wwebjs_auth'
            }),
            puppeteer: {
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                headless: true
            }
        });

        this.sessions.set(establishmentId, client);

        this.bindEvents(client, establishmentId);

        // Don't await initialization to prevent blocking the API response
        client.initialize().catch(async (error) => {
            console.error(`Failed to initialize client for ${establishmentId}:`, error);
            await this.updateStatus(establishmentId, 'disconnected', null);
            this.sessions.delete(establishmentId);
        });
    }

    bindEvents(client, establishmentId) {
        client.on('qr', async (qr) => {
            console.log(`QR for ${establishmentId} generated`);
            await this.updateStatus(establishmentId, 'connecting', qr);
        });

        client.on('ready', async () => {
            console.log(`Client ${establishmentId} is ready!`);
            await this.updateStatus(establishmentId, 'connected', null);
        });

        client.on('authenticated', () => {
            console.log(`Client ${establishmentId} authenticated`);
        });

        client.on('auth_failure', async (msg) => {
            console.error(`Auth failure for ${establishmentId}:`, msg);
            await this.updateStatus(establishmentId, 'disconnected', null);
        });

        client.on('disconnected', async (reason) => {
            console.log(`Client ${establishmentId} disconnected:`, reason);
            await this.updateStatus(establishmentId, 'disconnected', null);
            this.sessions.delete(establishmentId);
        });

        client.on('message', async (msg) => {
            console.log(`Message received for ${establishmentId}`);
            // Inject establishmentId into handlers
            try {
                // Assuming orderHandler is adapted to take establishmentId directly or via env (which is global, so we pass it explicitly)
                await orderHandler.handleMessage(msg, this.supabase, establishmentId);
            } catch (err) {
                console.error('Error handling message:', err);
            }
        });
    }

    async stopSession(establishmentId) {
        const client = this.sessions.get(establishmentId);
        if (client) {
            await client.destroy();
            this.sessions.delete(establishmentId);
            await this.updateStatus(establishmentId, 'disconnected', null);
            console.log(`Session stopped for ${establishmentId}`);
        }
    }

    async updateStatus(establishmentId, status, qr = null) {
        if (!this.supabase) return;

        const updateData = {
            whatsapp_status: status,
            whatsapp_updated_at: new Date().toISOString()
        };

        if (qr !== undefined) {
            updateData.whatsapp_qr = qr; // Pass null to clear it
        }

        const { error } = await this.supabase
            .from('establishments')
            .update(updateData)
            .eq('id', establishmentId);

        if (error) {
            console.error(`Error updating status for ${establishmentId}:`, error);
        }
    }
}

module.exports = new SessionManager();

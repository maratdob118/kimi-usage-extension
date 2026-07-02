const { GLib } = imports.gi;
const { GnomeShell } = imports;
const { Extension } = GnomeShell;
const { PanelMenu } = GnomeShell.UI;
const { PopupMenu } = GnomeShell.UI;
const { St } = imports.gi.St;

const CREDS_PATH = GLib.get_home_dir() + '/.kimi/credentials/kimi-code.json';
const USAGE_URL = 'https://api.kimi.com/coding/v1/usages';
const ICON_PATH = 'asset://button_kimi_svg'; // Kimi icon path
const POLL_INTERVAL = 60000; // 1 minute in ms
const MAX_POLL_INTERVAL = 600000; // 10 minutes in ms
const UPDATE_CHECK_INTERVAL = 86400000; // 24 hours in ms
const ICON_SIZE = 24;

class KimiUsageExtension extends Extension {
    constructor(metadata) {
        super(metadata);
    }

    enable() {
        this.indicator = new KimiUsageIndicator(this.metadata);
        Main.panel.addToStatusArea(this.uuid, this.indicator);
    }

    disable() {
        if (this.indicator) {
            this.indicator.destroy();
            this.indicator = null;
        }
    }
}

class KimiUsageIndicator extends PanelMenu.Button {
    constructor(metadata) {
        super({ entity: 'kimi-usage@' + metadata.uuid, label: 'Kimi Usage' });
        
        this._metadata = metadata;
        this._uuid = metadata.uuid;
        this._version = metadata.version;
        
        // Create label
        this._label = new St.Label({
            text: '✦ …',
            y_align: St.Align.CENTER
        });
        this.add_child(this._label);
        
        // Create menu items
        this._createMenuItems();
        
        // Initialize with data
        this._currentUsage = null;
        this._failures = 0;
        this._lastSuccess = null;
        this._updateTimer = null;
        this._updateCheckTimer = null;
        
        // Schedule first update
        GLib.timeout_add(5000, () => {
            this._updateUsageInfo();
            return GLib.SOURCE_CONTINUE;
        });
        
        // Schedule regular updates
        this._updateTimer = GLib.timeout_add(POLL_INTERVAL, () => {
            this._updateUsageInfo();
            return GLib.SOURCE_CONTINUE;
        });
        
        // Schedule update checks
        this._updateCheckTimer = GLib.timeout_add(UPDATE_CHECK_INTERVAL, () => {
            this._checkForUpdates();
            return GLib.SOURCE_CONTINUE;
        });
    }
    
    _createMenuItems() {
        this._menu = new PopupMenu.PopupMenu(this);
        
        // Current usage item
        this._currentItem = new PopupMenu.PopupMenuItem('Current: —');
        this._currentItem.setSensitive(false);
        this._menu.addMenuItem(this._currentItem);
        
        // Monthly limit item
        this._monthlyItem = new PopupMenu.PopupMenuItem('Monthly: —');
        this._monthlyItem.setSensitive(false);
        this._menu.addMenuItem(this._monthlyItem);
        
        // Separator
        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        // Settings item
        this._settingsItem = new PopupMenu.PopupMenuItem('Settings');
        this._settingsItem.connect('activate', () => {
            this._openSettings();
        });
        this._menu.addMenuItem(this._settingsItem);
        
        // Separator
        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        // Refresh item
        this._refreshItem = new PopupMenu.PopupMenuItem('Refresh Now');
        this._refreshItem.connect('activate', () => {
            this._manualRefresh();
        });
        this._menu.addMenuItem(this._refreshItem);
    }
    
    _updateUsageInfo() {
        // Read token and fetch usage data
        this._readToken((token) => {
            if (!token) {
                this._updateIndicator('✦ —', 'Not logged in to Kimi Code');
                return;
            }
            
            this._fetchUsageInfo(token, (success, data, error) => {
                if (success) {
                    this._currentUsage = data;
                    this._lastSuccess = data;
                    this._failures = 0;
                    this._updateUI(data);
                    
                    // Reset poll interval on success
                    if (this._updateTimer) {
                        GLib.source_remove(this._updateTimer);
                    }
                    this._updateTimer = GLib.timeout_add(POLL_INTERVAL, () => {
                        this._updateUsageInfo();
                        return GLib.SOURCE_CONTINUE;
                    });
                } else {
                    this._failures++;
                    const waitTime = Math.min(
                        POLL_INTERVAL * Math.pow(2, this._failures), 
                        MAX_POLL_INTERVAL
                    );
                    
                    this._updateIndicator('✦ —', error);
                    
                    if (this._updateTimer) {
                        GLib.source_remove(this._updateTimer);
                    }
                    this._updateTimer = GLib.timeout_add(waitTime, () => {
                        this._updateUsageInfo();
                        return GLib.SOURCE_CONTINUE;
                    });
                }
            });
        });
    }
    
    _readToken(callback) {
        // Read token from Kimi credentials file
        try {
            const file = Gio.File.new_for_path(CREDS_PATH);
            if (!file.query_exists(null)) {
                callback(null);
                return;
            }
            
            const [, contents] = file.load_contents(null);
            const creds = JSON.parse(new TextDecoder().decode(contents));
            const token = creds.access_token || creds.token || null;
            
            callback(token);
        } catch (e) {
            callback(null);
        }
    }
    
    _fetchUsageInfo(token, callback) {
        // Fetch usage data from Kimi API
        const url = USAGE_URL;
        const [client, message] = Gio.DBusProxy._create_for_bus_sync(
            Gio.BusType.SYSTEM,
            Gio.DBusProxyFlags.NONE,
            null,
            'org.gtk.Gio',
            url,
            'org.gtk.Gio',
            GLib.DBus.ARGS_NONE
        );
        
        // Use Gio to make HTTP request
        const connection = Gio.DBusConnection.get_sync(
            Gio.BusType.SYSTEM,
            null
        );
        
        const proxy = Gio.DBusProxy.new_sync(
            connection,
            Gio.DBusProxyFlags.NONE,
            'org.gtk.Gio',
            url,
            'org.gtk.Gio',
            null,
            GLib.DBus.ARGS_NONE
        );n
        // Note: In GNOME Shell, we would use Gio to make HTTP requests
        // Here we simulate with a timeout
        const timeout = GLib.timeout_add(5000, () => {
            callback(false, null, 'Request timed out');
            return GLib.SOURCE_REMOVE;
        });
        
        // Simulate successful response for demo
        const mockResponse = {
            current: 45,
            limit: 100,
            monthlyCurrent: 782,
            monthlyLimit: 2000,
            lastReset: Date.now() - 7 * 24 * 60 * 60 * 1000
        };
        
        GLib.source_remove(timeout);
        callback(true, mockResponse, null);
    }
    
    _updateUI(data) {
        // Update the indicator label
        const currentPercent = data ? Math.round((data.current / data.limit) * 100) : null;
        this._label.set_text(currentPercent !== null ? `✦ ${currentPercent}%` : '✦ —');
        
        // Update menu items
        if (data) {
            const currentText = `Current: ${data.current}/${data.limit} (${Math.round((data.current / data.limit) * 100)}%)`;
            const monthlyText = `Monthly: ${data.monthlyCurrent}/${data.monthlyLimit} (${Math.round((data.monthlyCurrent / data.monthlyLimit) * 100)}%)`;
            
            this._currentItem.label.set_text(currentText);
            this._monthlyItem.label.set_text(monthlyText);
            
            // Set color based on usage percentage
            const usagePercent = Math.round((data.current / data.limit) * 100);
            if (usagePercent >= 90) {
                this._label.set_style('color: #ff5544; font-weight: bold;');
            } else if (usagePercent >= 70) {
                this._label.set_style('color: #ffaa33;');
            } else {
                this._label.set_style(null);
            }
        }
    }
    
    _updateIndicator(text, tooltip) {
        this._label.set_text(text);
        // Update tooltip
    }
    
    _manualRefresh() {
        if (this._updateTimer) {
            GLib.source_remove(this._updateTimer);
        }
        this._updateUsageInfo();
    }
    
    _openSettings() {
        // Open settings dialog
        // Placeholder for future implementation
        global.log('Kimi Usage Extension settings not yet implemented');
    }
    
    _checkForUpdates() {
        // Check for updates from GitHub
        // Placeholder for future implementation
        global.log('Update check not yet implemented');
    }
    
    destroy() {
        if (this._updateTimer) {
            GLib.source_remove(this._updateTimer);
            this._updateTimer = null;
        }
        if (this._updateCheckTimer) {
            GLib.source_remove(this._updateCheckTimer);
            this._updateCheckTimer = null;
        }
        
        super.destroy();
    }
}

Gio.unregister_extension_class(KimiUsageExtension, KimiUsageExtension._name);

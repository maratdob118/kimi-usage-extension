import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

const USAGE_API_URL = 'https://api.kimi.com/coding/v1/usages';
const PANEL_PROGRESS_BAR_WIDTH = 50;
const MENU_PROGRESS_BAR_WIDTH = 240;

const KimiUsageIndicator = GObject.registerClass(
class KimiUsageIndicator extends PanelMenu.Button {
    _init(extensionPath, settings, openPreferences) {
        super._init(0.0, 'Kimi Usage Indicator');

        this._extensionPath = extensionPath;
        this._settings = settings;
        this._openPreferences = openPreferences;
        this._session = this._createSession();

        this._box = new St.BoxLayout({
            style_class: 'panel-status-menu-box',
        });

        const iconPath = GLib.build_filenamev([this._extensionPath, 'kimi-icon-22.png']);
        const gicon = Gio.icon_new_for_string(iconPath);
        this._icon = new St.Icon({
            gicon: gicon,
            style_class: 'kimi-icon',
            icon_size: 16,
        });
        this._box.add_child(this._icon);

        this._panelProgressBg = new St.Widget({
            style_class: 'kimi-panel-progress-bg',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._panelProgressBar = new St.Widget({
            style_class: 'kimi-panel-progress-bar',
        });
        this._panelProgressBg.add_child(this._panelProgressBar);
        this._box.add_child(this._panelProgressBg);

        this._label = new St.Label({
            text: '...',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'kimi-usage-label',
        });
        this._box.add_child(this._label);

        this.add_child(this._box);

        this._createMenu();

        this._updateDisplayMode();
        this._updateIconVisibility();
        this._updateIconStyle();
        this._updateUsageTitles();

        this._settingsChangedId = this._settings.connect('changed', (settings, key) => {
            if (key === 'refresh-interval') {
                this._restartTimer();
            } else if (key === 'display-mode') {
                this._updateDisplayMode();
            } else if (key === 'show-icon') {
                this._updateIconVisibility();
            } else if (key === 'icon-style') {
                this._updateIconStyle();
            } else if (key === 'proxy-url') {
                this._recreateSession();
            } else if (key === 'usage-display') {
                this._updateUsageTitles();
                this._refreshUsage();
            }
        });

        this._refreshUsage();
        this._startTimer();
    }

    _updateDisplayMode() {
        const mode = this._settings.get_string('display-mode');
        if (mode === 'bar') {
            this._panelProgressBg.show();
            this._label.hide();
            this._label.set_style('margin-left: 0;');
        } else if (mode === 'both') {
            this._panelProgressBg.show();
            this._label.show();
            this._label.set_style('margin-left: 6px;');
        } else {
            this._panelProgressBg.hide();
            this._label.show();
            this._label.set_style('margin-left: 0;');
        }
    }

    _updateIconVisibility() {
        const showIcon = this._settings.get_boolean('show-icon');
        if (showIcon) {
            this._icon.show();
        } else {
            this._icon.hide();
        }
    }

    _updateIconStyle() {
        const style = this._settings.get_string('icon-style');
        const desatName = 'monochrome-desaturate';
        const brightName = 'monochrome-brightness';
        const hasEffect = this._icon.get_effect(desatName) !== null;

        if (style === 'monochrome' && !hasEffect) {
            this._icon.add_effect(new Clutter.DesaturateEffect({factor: 1.0, name: desatName}));
            const brightnessEffect = new Clutter.BrightnessContrastEffect({name: brightName});
            brightnessEffect.set_brightness_full(1, 1, 1);
            this._icon.add_effect(brightnessEffect);
        } else if (style !== 'monochrome' && hasEffect) {
            this._icon.remove_effect_by_name(desatName);
            this._icon.remove_effect_by_name(brightName);
        }
    }

    _createSession() {
        const session = new Soup.Session();
        const proxyUrl = this._settings.get_string('proxy-url').trim();

        if (proxyUrl !== '') {
            const proxyResolver = Gio.SimpleProxyResolver.new(proxyUrl, null);
            session.set_proxy_resolver(proxyResolver);
        }

        return session;
    }

    _recreateSession() {
        if (this._session) {
            this._session.abort();
        }

        this._session = this._createSession();
        this._refreshUsage();
    }

    _createMenu() {
        const fiveHourBox = new St.BoxLayout({
            style_class: 'kimi-usage-section',
            vertical: true,
            x_expand: true,
        });
        const fiveHourHeader = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            style_class: 'kimi-section-header',
        });
        this._fiveHourTitle = new St.Label({
            text: '5-Hour Used',
            style_class: 'kimi-section-title',
            x_expand: true,
            x_align: Clutter.ActorAlign.START,
        });
        fiveHourHeader.add_child(this._fiveHourTitle);
        this._fiveHourPercent = new St.Label({
            text: '...',
            style_class: 'kimi-percent-label',
            x_align: Clutter.ActorAlign.END,
        });
        fiveHourHeader.add_child(this._fiveHourPercent);
        fiveHourBox.add_child(fiveHourHeader);

        const fiveHourProgressBg = new St.Widget({
            style_class: 'kimi-progress-bg',
            x_expand: true,
        });
        this._fiveHourProgressBar = new St.Widget({
            style_class: 'kimi-progress-bar usage-low',
        });
        fiveHourProgressBg.add_child(this._fiveHourProgressBar);
        fiveHourBox.add_child(fiveHourProgressBg);

        this._fiveHourResetLabel = new St.Label({
            text: 'Resets: ...',
            style_class: 'kimi-reset-label',
        });
        fiveHourBox.add_child(this._fiveHourResetLabel);

        const fiveHourItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
        });
        fiveHourItem.add_child(fiveHourBox);
        this.menu.addMenuItem(fiveHourItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const weeklyBox = new St.BoxLayout({
            style_class: 'kimi-usage-section',
            vertical: true,
            x_expand: true,
        });
        const weeklyHeader = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            style_class: 'kimi-section-header',
        });
        this._weeklyTitle = new St.Label({
            text: 'Weekly Used',
            style_class: 'kimi-section-title',
            x_expand: true,
            x_align: Clutter.ActorAlign.START,
        });
        weeklyHeader.add_child(this._weeklyTitle);
        this._weeklyPercent = new St.Label({
            text: '...',
            style_class: 'kimi-percent-label',
            x_align: Clutter.ActorAlign.END,
        });
        weeklyHeader.add_child(this._weeklyPercent);
        weeklyBox.add_child(weeklyHeader);

        const weeklyProgressBg = new St.Widget({
            style_class: 'kimi-progress-bg',
            x_expand: true,
        });
        this._weeklyProgressBar = new St.Widget({
            style_class: 'kimi-progress-bar usage-low',
        });
        weeklyProgressBg.add_child(this._weeklyProgressBar);
        weeklyBox.add_child(weeklyProgressBg);

        this._weeklyResetLabel = new St.Label({
            text: 'Resets: ...',
            style_class: 'kimi-reset-label',
        });
        weeklyBox.add_child(this._weeklyResetLabel);

        const weeklyItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
        });
        weeklyItem.add_child(weeklyBox);
        this.menu.addMenuItem(weeklyItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const footerItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
        });
        const footerBox = new St.BoxLayout({
            style_class: 'kimi-footer-box',
            x_expand: true,
        });
        const refreshContent = new St.BoxLayout({
            style_class: 'kimi-refresh-button-content',
        });
        this._refreshIcon = new St.Icon({
            icon_name: 'view-refresh-symbolic',
            style_class: 'kimi-refresh-button-icon',
            icon_size: 14,
            y_align: Clutter.ActorAlign.CENTER,
        });
        refreshContent.add_child(this._refreshIcon);
        this._refreshLabel = new St.Label({
            text: 'Refresh',
            style_class: 'kimi-refresh-button-label',
            y_align: Clutter.ActorAlign.CENTER,
        });
        refreshContent.add_child(this._refreshLabel);
        this._refreshButton = new St.Button({
            style_class: 'kimi-refresh-button',
            can_focus: true,
            reactive: true,
            track_hover: true,
        });
        this._refreshButton.set_child(refreshContent);
        this._refreshButton.connect('clicked', () => {
            this._refreshUsage();
        });
        footerBox.add_child(this._refreshButton);

        this._lastUpdatedLabel = new St.Label({
            text: 'Checked: —',
            style_class: 'kimi-last-updated-label',
            x_expand: true,
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.CENTER,
        });
        footerBox.add_child(this._lastUpdatedLabel);

        footerItem.add_child(footerBox);
        this.menu.addMenuItem(footerItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const settingsItem = new PopupMenu.PopupMenuItem('Settings');
        settingsItem.connect('activate', () => {
            this._openPreferences();
        });
        this.menu.addMenuItem(settingsItem);
    }

    _startTimer() {
        const interval = this._settings.get_int('refresh-interval');
        this._timerId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            interval,
            () => {
                this._refreshUsage();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    _stopTimer() {
        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = null;
        }
    }

    _restartTimer() {
        this._stopTimer();
        this._startTimer();
    }

    _refreshUsage() {
        const kimiHome = 
            GLib.build_filenamev([GLib.get_home_dir(), '.kimi', 'credentials']);
        const authPath = GLib.build_filenamev([kimiHome, 'kimi-code.json']);

        const file = Gio.File.new_for_path(authPath);
        file.load_contents_async(null, (file, result) => {
            try {
                const [, contents] = file.load_contents_finish(result);
                const decoder = new TextDecoder('utf-8');
                const auth = JSON.parse(decoder.decode(contents));
                const tokens = auth.tokens ?? auth;
                const accessToken = tokens.access_token ?? null;
                const accountId = tokens.account_id ?? null;

                if (!accessToken) {
                    this._setUnavailableState('—', 'Login required');
                    this._updateLastCheckedLabel();
                    return;
                }

                this._fetchUsage(accessToken, accountId);
            } catch (e) {
                console.error('Kimi Usage: Failed to read auth:', e.message);
                this._setUnavailableState('—', 'No auth');
                this._updateLastCheckedLabel();
            }
        });
    }

    _fetchUsage(accessToken, accountId) {
        const message = Soup.Message.new('GET', USAGE_API_URL);
        message.request_headers.append('Authorization', `Bearer ${accessToken}`);
        message.request_headers.append('User-Agent', 'KimiCLI/1.35');
        if (false) {
            
        }

        this._session.send_and_read_async(
            message,
            GLib.PRIORITY_DEFAULT,
            null,
            (session, result) => {
                try {
                    const bytes = session.send_and_read_finish(result);

                    if (message.status_code !== 200) {
                        this._setUnavailableState('Error', `HTTP ${message.status_code}`);
                        this._updateLastCheckedLabel();
                        return;
                    }

                    const decoder = new TextDecoder('utf-8');
                    const data = JSON.parse(decoder.decode(bytes.get_data()));

                    if (!data.usage && !data.limits) {
                        this._setUnavailableState('—', 'No data');
                    } else {
                        this._updateDisplay(this._normalizeApiResponse(data));
                    }
                    this._updateLastCheckedLabel();
                } catch (e) {
                    console.error('Kimi Usage: API request failed:', e.message);
                    this._setUnavailableState('Error', 'API failed');
                    this._updateLastCheckedLabel();
                }
            }
        );
    }

    _normalizeApiResponse(data) {
        // Parse Kimi response
        let rateLimit = { used: 0, limit: 100, resetTime: null };
        const limits = data.limits || [];
        for (const item of limits) {
            if (item.window && item.window.duration === 300) {
                rateLimit.used = parseInt(item.detail.used || 0, 10);
                rateLimit.limit = parseInt(item.detail.limit || 100, 10);
                rateLimit.resetTime = item.detail.resetTime;
                break;
            }
        }
        
        let weeklyLimit = { used: 0, limit: 100, resetTime: null };
        if (data.usage) {
            weeklyLimit.used = parseInt(data.usage.used || 0, 10);
            weeklyLimit.limit = parseInt(data.usage.limit || 100, 10);
            weeklyLimit.resetTime = data.usage.resetTime;
        }

        const toPercent = (u, l) => (l > 0 ? (u / l) * 100 : 0);

        return {
            rate_limit: {
                primary_window: {
                    used_percent: this._coercePercent(toPercent(rateLimit.used, rateLimit.limit)),
                    reset_at: rateLimit.resetTime ? new Date(rateLimit.resetTime.replace(/Z$/, "+00:00")).toISOString() : null,
                },
                secondary_window: {
                    used_percent: this._coercePercent(toPercent(weeklyLimit.used, weeklyLimit.limit)),
                    reset_at: weeklyLimit.resetTime ? new Date(weeklyLimit.resetTime.replace(/Z$/, "+00:00")).toISOString() : null,
                },
            },
        };
    }

    _coercePercent(value) {
        return typeof value === 'number' && Number.isFinite(value) ? value : 0;
    }

    _setUnavailableState(label, detail) {
        this._label.set_text(label);
        this._fiveHourPercent.set_text(detail);
        this._weeklyPercent.set_text('—');
        this._fiveHourResetLabel.set_text('Resets: —');
        this._weeklyResetLabel.set_text('Resets: —');
        this._updatePanelProgressBar(0);
        this._updateProgressBar(this._fiveHourProgressBar, 0);
        this._updateProgressBar(this._weeklyProgressBar, 0);
    }

    _updateDisplay(data) {
        const primaryUsed = this._usedPercent(data.rate_limit?.primary_window?.used_percent);
        const secondaryUsed = this._usedPercent(data.rate_limit?.secondary_window?.used_percent);
        const primaryDisplay = this._displayPercent(primaryUsed);
        const secondaryDisplay = this._displayPercent(secondaryUsed);
        const displaySuffix = this._usageDisplayMode() === 'remaining' ? 'remaining' : 'used';

        this._label.set_text(`${Math.round(primaryDisplay)}%`);

        this._updatePanelProgressBar(primaryDisplay);

        this._fiveHourPercent.set_text(`${primaryDisplay.toFixed(1)}% ${displaySuffix}`);
        this._updateProgressBar(this._fiveHourProgressBar, primaryDisplay);

        this._weeklyPercent.set_text(`${secondaryDisplay.toFixed(1)}% ${displaySuffix}`);
        this._updateProgressBar(this._weeklyProgressBar, secondaryDisplay);

        if (data.rate_limit?.primary_window?.reset_at) {
            this._fiveHourResetLabel.set_text(
                `Resets in ${this._formatResetTime(data.rate_limit.primary_window.reset_at)}`
            );
        } else {
            this._fiveHourResetLabel.set_text('Resets: —');
        }

        if (data.rate_limit?.secondary_window?.reset_at) {
            this._weeklyResetLabel.set_text(
                `Resets in ${this._formatResetTime(data.rate_limit.secondary_window.reset_at)}`
            );
        } else {
            this._weeklyResetLabel.set_text('Resets: —');
        }
    }

    _updatePanelProgressBar(usage) {
        const maxWidth = this._panelProgressBg.width > 0
            ? this._panelProgressBg.width
            : PANEL_PROGRESS_BAR_WIDTH;
        const width = Math.round((Math.min(100, Math.max(0, usage)) / 100) * maxWidth);
        this._panelProgressBar.set_width(width);
    }

    _updateProgressBar(progressBar, usage) {
        const normalizedUsage = this._usedPercent(usage);
        const progressBg = progressBar.get_parent();
        const maxWidth = progressBg?.width > 0
            ? progressBg.width
            : MENU_PROGRESS_BAR_WIDTH;
        const width = Math.round((normalizedUsage / 100) * maxWidth);
        progressBar.set_width(width);

        progressBar.remove_style_class_name('usage-low');
        progressBar.remove_style_class_name('usage-medium');
        progressBar.remove_style_class_name('usage-high');
        progressBar.remove_style_class_name('usage-critical');

        if (this._usageDisplayMode() === 'remaining') {
            if (normalizedUsage <= 10) {
                progressBar.add_style_class_name('usage-critical');
            } else if (normalizedUsage <= 30) {
                progressBar.add_style_class_name('usage-high');
            } else if (normalizedUsage <= 60) {
                progressBar.add_style_class_name('usage-medium');
            } else {
                progressBar.add_style_class_name('usage-low');
            }
        } else {
            if (normalizedUsage >= 90) {
                progressBar.add_style_class_name('usage-critical');
            } else if (normalizedUsage >= 70) {
                progressBar.add_style_class_name('usage-high');
            } else if (normalizedUsage >= 40) {
                progressBar.add_style_class_name('usage-medium');
            } else {
                progressBar.add_style_class_name('usage-low');
            }
        }
    }

    _usedPercent(usedPercent) {
        return Math.min(100, Math.max(0, this._coercePercent(usedPercent)));
    }

    _displayPercent(usedPercent) {
        const normalizedUsage = this._usedPercent(usedPercent);
        if (this._usageDisplayMode() === 'remaining') {
            return 100 - normalizedUsage;
        }

        return normalizedUsage;
    }

    _usageDisplayMode() {
        return this._settings.get_string('usage-display');
    }

    _updateUsageTitles() {
        const suffix = this._usageDisplayMode() === 'remaining' ? 'Remaining' : 'Used';
        this._fiveHourTitle.set_text(`5-Hour ${suffix}`);
        this._weeklyTitle.set_text(`Weekly ${suffix}`);
    }

    _formatResetTime(isoString) {
        try {
            const resetDate = new Date(isoString);
            const now = new Date();
            const diffMs = resetDate - now;

            if (diffMs < 0) {
                return 'now';
            }

            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffDays > 0) {
                return `${diffDays}d ${diffHours % 24}h`;
            } else if (diffHours > 0) {
                return `${diffHours}h ${diffMins % 60}m`;
            } else {
                return `${diffMins}m`;
            }
        } catch (e) {
            return '—';
        }
    }

    _updateLastCheckedLabel() {
        const now = GLib.DateTime.new_now_local();
        this._lastUpdatedLabel.set_text(`Checked: ${now.format('%H:%M:%S')}`);
    }

    destroy() {
        this._stopTimer();
        if (this._session) {
            this._session.abort();
            this._session = null;
        }
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }
        super.destroy();
    }
});

export default class KimiUsageExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicator = new KimiUsageIndicator(
            this.path,
            this._settings,
            () => this.openPreferences()
        );
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
        this._settings = null;
    }
}

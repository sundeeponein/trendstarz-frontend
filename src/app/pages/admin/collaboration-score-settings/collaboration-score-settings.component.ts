import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CollaborationScoreApiService,
  CollaborationScoreSettings,
  CollaborationScoreTodaySummary,
} from '../../../services/collaboration-score-api.service';
import { ToastService } from '../../../shared/toast/toast.service';

@Component({
  selector: 'app-collaboration-score-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './collaboration-score-settings.component.html',
  styleUrls: ['./collaboration-score-settings.component.scss'],
})
export class CollaborationScoreSettingsComponent implements OnInit {
  settings: CollaborationScoreSettings | null = null;
  loading = false;
  saving = false;
  summary: {
    totalAiCostUsd: number;
    totalAiInputTokens: number;
    totalAiOutputTokens: number;
    aiAuditCount: number;
    avgScore: number;
    recommendedCount: number;
  } | null = null;
  summaryLoading = false;
  todaySummary: CollaborationScoreTodaySummary | null = null;
  resetting = false;

  constructor(
    private readonly api: CollaborationScoreApiService,
    private readonly toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadSettings();
    this.loadSummary();
  }

  private loadSettings(): void {
    this.loading = true;
    this.api.getSettings().subscribe({
      next: (settings) => {
        this.settings = settings;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.toast.error('Could not load Collaboration Score settings.');
      },
    });
  }

  private loadSummary(): void {
    this.summaryLoading = true;
    this.api.getAdminList({ summary: true, limit: 1 }).subscribe({
      next: (res) => {
        this.summary = res?.summary || null;
        // Defaults platformBreakdown to [] here (not just in the template)
        // so a backend response that predates this field — or any other gap
        // — degrades to "no platform data" instead of throwing on `.length`.
        this.todaySummary = res?.todaySummary
          ? {
              ...res.todaySummary,
              platformBreakdown: (res.todaySummary.platformBreakdown || []).map((row) => ({
                ...row,
                aiCount: row.aiCount || 0,
                paidCount: row.paidCount || 0,
              })),
            }
          : null;
        this.summaryLoading = false;
      },
      error: () => {
        this.summaryLoading = false;
      },
    });
  }

  get scoreWeightsSum(): number {
    const w = this.settings?.scoreWeights;
    if (!w) return 0;
    return w.profileCompletion + w.contentQuality + w.postingConsistency + w.professionalBranding + w.campaignReadiness;
  }

  resetToDefaults(): void {
    if (this.resetting) return;
    if (!confirm('This deletes the current Collaboration Score configuration and restores the JSON defaults. Continue?')) {
      return;
    }
    this.resetting = true;
    this.api.resetSettings().subscribe({
      next: (settings) => {
        this.settings = settings;
        this.resetting = false;
        this.toast.success('Settings reset to defaults.');
      },
      error: () => {
        this.resetting = false;
        this.toast.error('Could not reset settings. Please try again.');
      },
    });
  }

  save(): void {
    if (!this.settings) return;
    this.saving = true;
    this.api.updateSettings(this.settings).subscribe({
      next: (settings) => {
        this.settings = settings;
        this.saving = false;
        this.toast.success('Collaboration Score settings saved.');
      },
      error: () => {
        this.saving = false;
        this.toast.error('Could not save settings. Please try again.');
      },
    });
  }
}

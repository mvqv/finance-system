export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_debates: {
        Row: {
          agent: Database["public"]["Enums"]["agent_kind"]
          argument: string
          confidence: number | null
          created_at: string
          evidence: Json | null
          id: string
          idea_id: string
          latency_ms: number | null
          model: string | null
          owner_id: string
          stance: string | null
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          agent: Database["public"]["Enums"]["agent_kind"]
          argument: string
          confidence?: number | null
          created_at?: string
          evidence?: Json | null
          id?: string
          idea_id: string
          latency_ms?: number | null
          model?: string | null
          owner_id?: string
          stance?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          agent?: Database["public"]["Enums"]["agent_kind"]
          argument?: string
          confidence?: number | null
          created_at?: string
          evidence?: Json | null
          id?: string
          idea_id?: string
          latency_ms?: number | null
          model?: string | null
          owner_id?: string
          stance?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_debates_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_scorecards: {
        Row: {
          agent: string
          avg_confidence: number | null
          avg_latency_ms: number | null
          contribution_to_pnl: number | null
          hit_rate: number | null
          id: string
          last_computed_at: string
          metadata: Json
          owner_id: string
          signals_correct: number
          signals_total: number
          win_rate: number | null
          window_days: number
        }
        Insert: {
          agent: string
          avg_confidence?: number | null
          avg_latency_ms?: number | null
          contribution_to_pnl?: number | null
          hit_rate?: number | null
          id?: string
          last_computed_at?: string
          metadata?: Json
          owner_id?: string
          signals_correct?: number
          signals_total?: number
          win_rate?: number | null
          window_days?: number
        }
        Update: {
          agent?: string
          avg_confidence?: number | null
          avg_latency_ms?: number | null
          contribution_to_pnl?: number | null
          hit_rate?: number | null
          id?: string
          last_computed_at?: string
          metadata?: Json
          owner_id?: string
          signals_correct?: number
          signals_total?: number
          win_rate?: number | null
          window_days?: number
        }
        Relationships: []
      }
      alerts: {
        Row: {
          body: string | null
          category: string
          created_at: string
          dismissed_at: string | null
          id: string
          idea_id: string | null
          metadata: Json
          owner_id: string
          read_at: string | null
          severity: string
          source: string | null
          ticker: string | null
          title: string
        }
        Insert: {
          body?: string | null
          category?: string
          created_at?: string
          dismissed_at?: string | null
          id?: string
          idea_id?: string | null
          metadata?: Json
          owner_id?: string
          read_at?: string | null
          severity?: string
          source?: string | null
          ticker?: string | null
          title: string
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          dismissed_at?: string | null
          id?: string
          idea_id?: string | null
          metadata?: Json
          owner_id?: string
          read_at?: string | null
          severity?: string
          source?: string | null
          ticker?: string | null
          title?: string
        }
        Relationships: []
      }
      asset_features: {
        Row: {
          as_of: string
          asset_id: string
          benchmark_ticker: string | null
          beta_benchmark: number | null
          beta_spy: number | null
          created_at: string
          dist_52w_high: number | null
          dist_52w_low: number | null
          id: string
          latest_close: number | null
          latest_volume: number | null
          metadata: Json
          momentum_20d: number | null
          momentum_5d: number | null
          owner_id: string
          rvol: number | null
          vol_20d: number | null
          vol_60d: number | null
        }
        Insert: {
          as_of?: string
          asset_id: string
          benchmark_ticker?: string | null
          beta_benchmark?: number | null
          beta_spy?: number | null
          created_at?: string
          dist_52w_high?: number | null
          dist_52w_low?: number | null
          id?: string
          latest_close?: number | null
          latest_volume?: number | null
          metadata?: Json
          momentum_20d?: number | null
          momentum_5d?: number | null
          owner_id?: string
          rvol?: number | null
          vol_20d?: number | null
          vol_60d?: number | null
        }
        Update: {
          as_of?: string
          asset_id?: string
          benchmark_ticker?: string | null
          beta_benchmark?: number | null
          beta_spy?: number | null
          created_at?: string
          dist_52w_high?: number | null
          dist_52w_low?: number | null
          id?: string
          latest_close?: number | null
          latest_volume?: number | null
          metadata?: Json
          momentum_20d?: number | null
          momentum_5d?: number | null
          owner_id?: string
          rvol?: number | null
          vol_20d?: number | null
          vol_60d?: number | null
        }
        Relationships: []
      }
      assets: {
        Row: {
          asset_class: string
          country: string | null
          created_at: string
          currency: string | null
          debt_to_market_cap: number | null
          exchange: string | null
          haram_revenue_pct: number | null
          id: string
          interest_bearing_cash: number | null
          katilim_compliant: boolean | null
          metadata: Json | null
          name: string
          owner_id: string
          sector: string | null
          shariah_last_checked: string | null
          shariah_status: string | null
          ticker: string
        }
        Insert: {
          asset_class: string
          country?: string | null
          created_at?: string
          currency?: string | null
          debt_to_market_cap?: number | null
          exchange?: string | null
          haram_revenue_pct?: number | null
          id?: string
          interest_bearing_cash?: number | null
          katilim_compliant?: boolean | null
          metadata?: Json | null
          name: string
          owner_id?: string
          sector?: string | null
          shariah_last_checked?: string | null
          shariah_status?: string | null
          ticker: string
        }
        Update: {
          asset_class?: string
          country?: string | null
          created_at?: string
          currency?: string | null
          debt_to_market_cap?: number | null
          exchange?: string | null
          haram_revenue_pct?: number | null
          id?: string
          interest_bearing_cash?: number | null
          katilim_compliant?: boolean | null
          metadata?: Json | null
          name?: string
          owner_id?: string
          sector?: string | null
          shariah_last_checked?: string | null
          shariah_status?: string | null
          ticker?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          payload: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          asset_id: string | null
          created_at: string
          event_type: string
          headline: string
          id: string
          importance: number
          metadata: Json | null
          occurred_at: string
          owner_id: string
          sentiment: number | null
          source: string | null
          summary: string | null
          url: string | null
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          event_type: string
          headline: string
          id?: string
          importance?: number
          metadata?: Json | null
          occurred_at?: string
          owner_id?: string
          sentiment?: number | null
          source?: string | null
          summary?: string | null
          url?: string | null
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          event_type?: string
          headline?: string
          id?: string
          importance?: number
          metadata?: Json | null
          occurred_at?: string
          owner_id?: string
          sentiment?: number | null
          source?: string | null
          summary?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      ideas: {
        Row: {
          asset_id: string | null
          asymmetry: number | null
          confidence: number | null
          confidence_score: number | null
          consensus_score: number | null
          created_at: string
          created_by: string | null
          edge_score: number | null
          id: string
          invalidation: string | null
          liquidity_score: number | null
          market: string | null
          owner_id: string
          recommended_action: string | null
          risk_score: number | null
          side: Database["public"]["Enums"]["position_side"]
          status: Database["public"]["Enums"]["idea_status"]
          thesis: string
          timing_score: number | null
          title: string
          trigger: string | null
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          asymmetry?: number | null
          confidence?: number | null
          confidence_score?: number | null
          consensus_score?: number | null
          created_at?: string
          created_by?: string | null
          edge_score?: number | null
          id?: string
          invalidation?: string | null
          liquidity_score?: number | null
          market?: string | null
          owner_id?: string
          recommended_action?: string | null
          risk_score?: number | null
          side: Database["public"]["Enums"]["position_side"]
          status?: Database["public"]["Enums"]["idea_status"]
          thesis: string
          timing_score?: number | null
          title: string
          trigger?: string | null
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          asymmetry?: number | null
          confidence?: number | null
          confidence_score?: number | null
          consensus_score?: number | null
          created_at?: string
          created_by?: string | null
          edge_score?: number | null
          id?: string
          invalidation?: string | null
          liquidity_score?: number | null
          market?: string | null
          owner_id?: string
          recommended_action?: string | null
          risk_score?: number | null
          side?: Database["public"]["Enums"]["position_side"]
          status?: Database["public"]["Enums"]["idea_status"]
          thesis?: string
          timing_score?: number | null
          title?: string
          trigger?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ideas_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_memos: {
        Row: {
          content: Json
          created_at: string
          generated_by_model: string | null
          id: string
          idea_id: string
          latency_ms: number | null
          owner_id: string
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          content: Json
          created_at?: string
          generated_by_model?: string | null
          id?: string
          idea_id: string
          latency_ms?: number | null
          owner_id?: string
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          content?: Json
          created_at?: string
          generated_by_model?: string | null
          id?: string
          idea_id?: string
          latency_ms?: number | null
          owner_id?: string
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "investment_memos_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      kill_switch_state: {
        Row: {
          engaged: boolean
          engaged_at: string | null
          engaged_by: string | null
          id: number
          reason: string | null
        }
        Insert: {
          engaged?: boolean
          engaged_at?: string | null
          engaged_by?: string | null
          id?: number
          reason?: string | null
        }
        Update: {
          engaged?: boolean
          engaged_at?: string | null
          engaged_by?: string | null
          id?: number
          reason?: string | null
        }
        Relationships: []
      }
      macro_indicators: {
        Row: {
          fetched_at: string
          id: string
          label: string
          observed_at: string
          owner_id: string
          series_id: string
          unit: string | null
          value: number
        }
        Insert: {
          fetched_at?: string
          id?: string
          label: string
          observed_at: string
          owner_id?: string
          series_id: string
          unit?: string | null
          value: number
        }
        Update: {
          fetched_at?: string
          id?: string
          label?: string
          observed_at?: string
          owner_id?: string
          series_id?: string
          unit?: string | null
          value?: number
        }
        Relationships: []
      }
      market_limits: {
        Row: {
          id: string
          market: string
          max_daily_risk_pct: number
          max_gross_exposure_pct: number
          max_position_pct: number
          notes: string | null
          owner_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          market: string
          max_daily_risk_pct?: number
          max_gross_exposure_pct?: number
          max_position_pct?: number
          notes?: string | null
          owner_id?: string
          updated_at?: string
        }
        Update: {
          id?: string
          market?: string
          max_daily_risk_pct?: number
          max_gross_exposure_pct?: number
          max_position_pct?: number
          notes?: string | null
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          approved_by: string | null
          asset_id: string
          broker_order_id: string | null
          created_at: string
          error_message: string | null
          filled_price: number | null
          filled_quantity: number | null
          id: string
          idea_id: string | null
          limit_price: number | null
          order_type: string
          owner_id: string
          quantity: number
          side: Database["public"]["Enums"]["position_side"]
          status: string
          submitted_at: string | null
        }
        Insert: {
          approved_by?: string | null
          asset_id: string
          broker_order_id?: string | null
          created_at?: string
          error_message?: string | null
          filled_price?: number | null
          filled_quantity?: number | null
          id?: string
          idea_id?: string | null
          limit_price?: number | null
          order_type?: string
          owner_id?: string
          quantity: number
          side: Database["public"]["Enums"]["position_side"]
          status?: string
          submitted_at?: string | null
        }
        Update: {
          approved_by?: string | null
          asset_id?: string
          broker_order_id?: string | null
          created_at?: string
          error_message?: string | null
          filled_price?: number | null
          filled_quantity?: number | null
          id?: string
          idea_id?: string | null
          limit_price?: number | null
          order_type?: string
          owner_id?: string
          quantity?: number
          side?: Database["public"]["Enums"]["position_side"]
          status?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_snapshots: {
        Row: {
          cash: number
          daily_pnl: number | null
          daily_risk_used_pct: number | null
          id: string
          owner_id: string
          regime: Database["public"]["Enums"]["market_regime"] | null
          snapshot_at: string
          total_equity: number
        }
        Insert: {
          cash: number
          daily_pnl?: number | null
          daily_risk_used_pct?: number | null
          id?: string
          owner_id?: string
          regime?: Database["public"]["Enums"]["market_regime"] | null
          snapshot_at?: string
          total_equity: number
        }
        Update: {
          cash?: number
          daily_pnl?: number | null
          daily_risk_used_pct?: number | null
          id?: string
          owner_id?: string
          regime?: Database["public"]["Enums"]["market_regime"] | null
          snapshot_at?: string
          total_equity?: number
        }
        Relationships: []
      }
      position_reconciliation: {
        Row: {
          asset_id: string | null
          broker_avg_price: number | null
          broker_quantity: number | null
          created_at: string
          delta_quantity: number | null
          delta_value: number | null
          id: string
          internal_avg_price: number | null
          internal_quantity: number | null
          notes: string | null
          owner_id: string
          resolved_at: string | null
          status: string
          ticker: string
        }
        Insert: {
          asset_id?: string | null
          broker_avg_price?: number | null
          broker_quantity?: number | null
          created_at?: string
          delta_quantity?: number | null
          delta_value?: number | null
          id?: string
          internal_avg_price?: number | null
          internal_quantity?: number | null
          notes?: string | null
          owner_id?: string
          resolved_at?: string | null
          status?: string
          ticker: string
        }
        Update: {
          asset_id?: string | null
          broker_avg_price?: number | null
          broker_quantity?: number | null
          created_at?: string
          delta_quantity?: number | null
          delta_value?: number | null
          id?: string
          internal_avg_price?: number | null
          internal_quantity?: number | null
          notes?: string | null
          owner_id?: string
          resolved_at?: string | null
          status?: string
          ticker?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          asset_id: string
          avg_price: number
          closed_at: string | null
          current_price: number | null
          id: string
          idea_id: string | null
          last_synced_at: string | null
          opened_at: string
          owner_id: string
          quantity: number
          side: Database["public"]["Enums"]["position_side"]
          stop_loss: number | null
          take_profit: number | null
          unrealized_pnl: number | null
          weight_pct: number | null
        }
        Insert: {
          asset_id: string
          avg_price: number
          closed_at?: string | null
          current_price?: number | null
          id?: string
          idea_id?: string | null
          last_synced_at?: string | null
          opened_at?: string
          owner_id?: string
          quantity: number
          side: Database["public"]["Enums"]["position_side"]
          stop_loss?: number | null
          take_profit?: number | null
          unrealized_pnl?: number | null
          weight_pct?: number | null
        }
        Update: {
          asset_id?: string
          avg_price?: number
          closed_at?: string | null
          current_price?: number | null
          id?: string
          idea_id?: string | null
          last_synced_at?: string | null
          opened_at?: string
          owner_id?: string
          quantity?: number
          side?: Database["public"]["Enums"]["position_side"]
          stop_loss?: number | null
          take_profit?: number | null
          unrealized_pnl?: number | null
          weight_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "positions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      postmortems: {
        Row: {
          created_at: string
          generated_by_model: string | null
          id: string
          idea_id: string
          latency_ms: number | null
          lessons: string | null
          owner_id: string
          score: number | null
          summary: string
          tokens_in: number | null
          tokens_out: number | null
          trade_journal_id: string | null
          what_failed: string | null
          what_worked: string | null
        }
        Insert: {
          created_at?: string
          generated_by_model?: string | null
          id?: string
          idea_id: string
          latency_ms?: number | null
          lessons?: string | null
          owner_id?: string
          score?: number | null
          summary: string
          tokens_in?: number | null
          tokens_out?: number | null
          trade_journal_id?: string | null
          what_failed?: string | null
          what_worked?: string | null
        }
        Update: {
          created_at?: string
          generated_by_model?: string | null
          id?: string
          idea_id?: string
          latency_ms?: number | null
          lessons?: string | null
          owner_id?: string
          score?: number | null
          summary?: string
          tokens_in?: number | null
          tokens_out?: number | null
          trade_journal_id?: string | null
          what_failed?: string | null
          what_worked?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      research_documents: {
        Row: {
          asset_id: string | null
          content: string
          created_at: string
          embedding: string | null
          id: string
          idea_id: string | null
          kind: string
          metadata: Json
          owner_id: string
          title: string
        }
        Insert: {
          asset_id?: string | null
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          idea_id?: string | null
          kind: string
          metadata?: Json
          owner_id?: string
          title: string
        }
        Update: {
          asset_id?: string | null
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          idea_id?: string | null
          kind?: string
          metadata?: Json
          owner_id?: string
          title?: string
        }
        Relationships: []
      }
      risk_assessments: {
        Row: {
          created_at: string
          id: string
          idea_id: string
          limits_used: Json | null
          market: string | null
          max_position_pct: number | null
          owner_id: string
          rationale: string | null
          verdict: Database["public"]["Enums"]["risk_verdict"]
        }
        Insert: {
          created_at?: string
          id?: string
          idea_id: string
          limits_used?: Json | null
          market?: string | null
          max_position_pct?: number | null
          owner_id?: string
          rationale?: string | null
          verdict: Database["public"]["Enums"]["risk_verdict"]
        }
        Update: {
          created_at?: string
          id?: string
          idea_id?: string
          limits_used?: Json | null
          market?: string | null
          max_position_pct?: number | null
          owner_id?: string
          rationale?: string | null
          verdict?: Database["public"]["Enums"]["risk_verdict"]
        }
        Relationships: [
          {
            foreignKeyName: "risk_assessments_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      stress_results: {
        Row: {
          computed_at: string
          id: string
          metadata: Json
          owner_id: string
          projected_drawdown_pct: number | null
          projected_pnl: number | null
          scenario_id: string
          worst_position_pnl: number | null
          worst_position_ticker: string | null
        }
        Insert: {
          computed_at?: string
          id?: string
          metadata?: Json
          owner_id?: string
          projected_drawdown_pct?: number | null
          projected_pnl?: number | null
          scenario_id: string
          worst_position_pnl?: number | null
          worst_position_ticker?: string | null
        }
        Update: {
          computed_at?: string
          id?: string
          metadata?: Json
          owner_id?: string
          projected_drawdown_pct?: number | null
          projected_pnl?: number | null
          scenario_id?: string
          worst_position_pnl?: number | null
          worst_position_ticker?: string | null
        }
        Relationships: []
      }
      stress_scenarios: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          shocks: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id?: string
          shocks?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          shocks?: Json
        }
        Relationships: []
      }
      system_health_log: {
        Row: {
          component: string
          created_at: string
          id: string
          message: string | null
          metadata: Json | null
          owner_id: string
          status: Database["public"]["Enums"]["system_status"]
        }
        Insert: {
          component: string
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          owner_id?: string
          status: Database["public"]["Enums"]["system_status"]
        }
        Update: {
          component?: string
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          owner_id?: string
          status?: Database["public"]["Enums"]["system_status"]
        }
        Relationships: []
      }
      terminal_state: {
        Row: {
          changed_at: string
          changed_by: string | null
          current_mode: string
          reason: string | null
          source_id: string | null
          source_type: string | null
          user_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          current_mode?: string
          reason?: string | null
          source_id?: string | null
          source_type?: string | null
          user_id?: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          current_mode?: string
          reason?: string | null
          source_id?: string | null
          source_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      terminal_transitions: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_mode: string | null
          id: string
          owner_id: string
          reason: string | null
          source_id: string | null
          source_type: string | null
          to_mode: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_mode?: string | null
          id?: string
          owner_id?: string
          reason?: string | null
          source_id?: string | null
          source_type?: string | null
          to_mode: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_mode?: string | null
          id?: string
          owner_id?: string
          reason?: string | null
          source_id?: string | null
          source_type?: string | null
          to_mode?: string
        }
        Relationships: []
      }
      trade_journal: {
        Row: {
          asset_id: string | null
          closed_at: string | null
          created_at: string
          entry_price: number | null
          exit_price: number | null
          id: string
          idea_id: string | null
          opened_at: string | null
          owner_id: string
          pnl: number | null
          reason_in: string | null
          reason_out: string | null
          side: Database["public"]["Enums"]["position_side"]
        }
        Insert: {
          asset_id?: string | null
          closed_at?: string | null
          created_at?: string
          entry_price?: number | null
          exit_price?: number | null
          id?: string
          idea_id?: string | null
          opened_at?: string | null
          owner_id?: string
          pnl?: number | null
          reason_in?: string | null
          reason_out?: string | null
          side: Database["public"]["Enums"]["position_side"]
        }
        Update: {
          asset_id?: string | null
          closed_at?: string | null
          created_at?: string
          entry_price?: number | null
          exit_price?: number | null
          id?: string
          idea_id?: string | null
          opened_at?: string | null
          owner_id?: string
          pnl?: number | null
          reason_in?: string | null
          reason_out?: string | null
          side?: Database["public"]["Enums"]["position_side"]
        }
        Relationships: [
          {
            foreignKeyName: "trade_journal_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_journal_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          added_by: string | null
          asset_id: string
          created_at: string
          id: string
          owner_id: string
          trigger_note: string | null
        }
        Insert: {
          added_by?: string | null
          asset_id: string
          created_at?: string
          id?: string
          owner_id?: string
          trigger_note?: string | null
        }
        Update: {
          added_by?: string | null
          asset_id?: string
          created_at?: string
          id?: string
          owner_id?: string
          trigger_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_owner_or_operator: { Args: { _user_id: string }; Returns: boolean }
      match_research_documents: {
        Args: {
          filter_asset?: string
          filter_idea?: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          asset_id: string
          content: string
          id: string
          idea_id: string
          kind: string
          metadata: Json
          similarity: number
          title: string
        }[]
      }
      set_terminal_mode: {
        Args: {
          _mode: string
          _reason: string
          _source_id: string
          _source_type: string
        }
        Returns: undefined
      }
    }
    Enums: {
      agent_kind:
        | "cio"
        | "macro"
        | "fundamental"
        | "news"
        | "options"
        | "flow"
        | "quant"
        | "bear"
        | "risk"
        | "portfolio"
        | "execution"
        | "operations"
        | "memory"
      app_role: "owner" | "operator" | "viewer"
      idea_status:
        | "draft"
        | "researching"
        | "debating"
        | "risk_review"
        | "awaiting_approval"
        | "approved"
        | "rejected"
        | "executed"
        | "closed"
        | "invalidated"
      market_regime:
        | "risk_on"
        | "risk_off"
        | "neutral"
        | "inflation_shock"
        | "liquidity_squeeze"
        | "try_crisis"
      position_side: "long" | "short"
      risk_verdict:
        | "approve"
        | "reduce_size"
        | "wait"
        | "reject"
        | "kill_switch"
      system_status: "green" | "yellow" | "red" | "black"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agent_kind: [
        "cio",
        "macro",
        "fundamental",
        "news",
        "options",
        "flow",
        "quant",
        "bear",
        "risk",
        "portfolio",
        "execution",
        "operations",
        "memory",
      ],
      app_role: ["owner", "operator", "viewer"],
      idea_status: [
        "draft",
        "researching",
        "debating",
        "risk_review",
        "awaiting_approval",
        "approved",
        "rejected",
        "executed",
        "closed",
        "invalidated",
      ],
      market_regime: [
        "risk_on",
        "risk_off",
        "neutral",
        "inflation_shock",
        "liquidity_squeeze",
        "try_crisis",
      ],
      position_side: ["long", "short"],
      risk_verdict: ["approve", "reduce_size", "wait", "reject", "kill_switch"],
      system_status: ["green", "yellow", "red", "black"],
    },
  },
} as const

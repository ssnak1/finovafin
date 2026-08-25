export type AccountType = "checking" | "savings" | "credit_card" | "cash" | "investment";
export type CategoryKind = "income" | "expense";
export type TransactionType = "income" | "expense" | "transfer";

type ProfileRow = {
  id: string;
  full_name: string | null;
  created_at: string;
};

type AccountRow = {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  initial_balance: number;
  color: string;
  /** Slug da instituição (ver src/lib/banks.ts); null quando não informado. */
  institution: string | null;
  /** Só preenchidos em contas do tipo credit_card. */
  credit_limit: number | null;
  closing_day: number | null;
  due_day: number | null;
  /** No cartão, aponta para a conta que paga a fatura. */
  linked_account_id: string | null;
  archived: boolean;
  created_at: string;
};

type CategoryRow = {
  id: string;
  user_id: string;
  name: string;
  kind: CategoryKind;
  color: string;
  created_at: string;
};

type TransactionRow = {
  id: string;
  user_id: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  type: TransactionType;
  amount: number;
  description: string | null;
  occurred_on: string;
  created_at: string;
  /** Parcelas da mesma compra compartilham o group; number/total são 3 e 12 em "3/12". */
  installment_group: string | null;
  installment_number: number | null;
  installment_total: number | null;
};

type AccountBalanceRow = {
  account_id: string;
  user_id: string;
  name: string;
  type: AccountType;
  color: string;
  institution: string | null;
  credit_limit: number | null;
  closing_day: number | null;
  due_day: number | null;
  linked_account_id: string | null;
  archived: boolean;
  initial_balance: number;
  /** Tudo, inclusive lançamentos com data futura (limite comprometido). */
  balance: number;
  /** Só o que já ocorreu até hoje (quanto tenho / quanto devo agora). */
  posted_balance: number;
};

type CardStatementRow = {
  id: string;
  user_id: string;
  account_id: string;
  reference_month: string;
  paid_at: string;
  payment_id: string | null;
};

/**
 * Formato que o postgrest-js espera. `Relationships` é obrigatório em toda
 * tabela e view: sem ele o schema não satisfaz `GenericSchema` e as operações
 * passam a inferir `never`.
 */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Omit<ProfileRow, "created_at"> & { created_at?: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      accounts: {
        Row: AccountRow;
        Insert: Omit<
          AccountRow,
          | "id"
          | "created_at"
          | "archived"
          | "institution"
          | "credit_limit"
          | "closing_day"
          | "due_day"
          | "linked_account_id"
        > & {
          id?: string;
          created_at?: string;
          archived?: boolean;
          institution?: string | null;
          credit_limit?: number | null;
          closing_day?: number | null;
          due_day?: number | null;
          linked_account_id?: string | null;
        };
        Update: Partial<Omit<AccountRow, "id" | "user_id">>;
        Relationships: [];
      };
      categories: {
        Row: CategoryRow;
        Insert: Omit<CategoryRow, "id" | "created_at" | "color"> & {
          id?: string;
          created_at?: string;
          color?: string;
        };
        Update: Partial<Omit<CategoryRow, "id" | "user_id">>;
        Relationships: [];
      };
      transactions: {
        Row: TransactionRow;
        Insert: Omit<
          TransactionRow,
          "id" | "created_at" | "installment_group" | "installment_number" | "installment_total"
        > & {
          id?: string;
          created_at?: string;
          installment_group?: string | null;
          installment_number?: number | null;
          installment_total?: number | null;
        };
        Update: Partial<Omit<TransactionRow, "id" | "user_id">>;
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey";
            columns: ["to_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      card_statements: {
        Row: CardStatementRow;
        Insert: Omit<CardStatementRow, "id" | "paid_at" | "payment_id"> & {
          id?: string;
          paid_at?: string;
          payment_id?: string | null;
        };
        Update: Partial<Omit<CardStatementRow, "id" | "user_id">>;
        Relationships: [
          {
            foreignKeyName: "card_statements_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      account_balances: {
        Row: AccountBalanceRow;
        Relationships: [];
      };
    };
    Functions: { [_ in never]: never };
    Enums: {
      account_type: AccountType;
      category_kind: CategoryKind;
      transaction_type: TransactionType;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

/** Uma transação com conta e categoria já resolvidas pelo join. */
export type TransactionWithRelations = TransactionRow & {
  account: Pick<AccountRow, "id" | "name" | "color" | "institution" | "type"> | null;
  to_account: Pick<AccountRow, "id" | "name" | "color" | "institution" | "type"> | null;
  category: Pick<CategoryRow, "id" | "name" | "color" | "kind"> | null;
};

export type Account = AccountRow;
export type AccountBalance = AccountBalanceRow;
export type Category = CategoryRow;
export type Transaction = TransactionRow;
export type Profile = ProfileRow;

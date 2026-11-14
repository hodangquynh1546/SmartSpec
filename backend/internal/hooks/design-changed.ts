import { Schema } from "mongoose";

type Listener = (projectId: string) => void;
let listener: Listener | null = null;

/** The WorkHub sync registers itself here at startup; models only know this tiny contract. */
export const setDesignChangedListener = (fn: Listener | null) => { listener = fn; };

const notify = (projectId: unknown) => {
  if (projectId && listener) {
    try { listener(String(projectId)); } catch { /* never break a database write */ }
  }
};

const QUERY_OPS = ["findOneAndUpdate", "findOneAndDelete", "findOneAndReplace", "updateOne", "updateMany", "deleteOne", "deleteMany"] as const;

/**
 * Any change to a design artifact (diagrams, database design, test cases) tells the WorkHub sync, whichever code path
 * wrote it. Query operations that return no document first remember which project the target belongs to.
 */
export function attachDesignHooks(schema: Schema) {
  schema.post("save", function (doc: any) { notify(doc?.project_id); });
  schema.post("insertMany", function (docs: any) { for (const d of Array.isArray(docs) ? docs : [docs]) notify(d?.project_id); });
  schema.pre(QUERY_OPS as any, async function (this: any) {
    try {
      const f = this.getFilter?.() ?? {};
      if (f.project_id) { this._designProject = f.project_id; return; }
      const d = await this.model.findOne(f).select("project_id").lean();
      this._designProject = d?.project_id;
    } catch { /* best effort */ }
  });
  schema.post(QUERY_OPS as any, function (this: any, res: any) {
    notify(res?.project_id ?? this._designProject);
  });
}

const PROJECT_FIELDS = /^(name|description|members|owner_id)(\.|$)/;

/**
 * Creating a project, renaming it or changing its members tells the WorkHub sync (the WorkHub project is created
 * right away, not only after the first analysis). Writes that only touch `workhub.*` (progress reported back) are
 * ignored, otherwise every sync would trigger the next one.
 */
export function attachProjectHooks(schema: Schema) {
  schema.pre("save", function (this: any) {
    this._wsRelevant = this.isNew || this.modifiedPaths().some((p: string) => PROJECT_FIELDS.test(p));
  });
  schema.post("save", function (doc: any) { if ((doc as any)._wsRelevant) notify(doc?._id); });
  schema.post("insertMany", function (docs: any) { for (const d of Array.isArray(docs) ? docs : [docs]) notify(d?._id); });
  schema.pre(["findOneAndUpdate", "updateOne"] as any, async function (this: any) {
    try {
      const u = this.getUpdate?.() ?? {};
      const keys = [...Object.keys(u).filter((k) => !k.startsWith("$")), ...Object.values(u).filter((v) => v && typeof v === "object").flatMap((v: any) => Object.keys(v))];
      this._wsRelevant = keys.some((k) => PROJECT_FIELDS.test(k));
      const f = this.getFilter?.() ?? {};
      this._wsProject = f._id ?? (await this.model.findOne(f).select("_id").lean())?._id;
    } catch { /* best effort */ }
  });
  schema.post(["findOneAndUpdate", "updateOne"] as any, function (this: any, res: any) {
    if (this._wsRelevant) notify(res?._id ?? this._wsProject);
  });
}

const USECASE_PROGRESS_ONLY = /^(implementation|bug)(\.|$)/;

/**
 * Any change to a use case (created, edited, deleted, or a creation undone in the preview) tells the WorkHub sync,
 * whichever code path wrote it. Writes that only record progress reported back from WorkHub (`implementation`) are
 * ignored, otherwise every sync would trigger the next one.
 */
export function attachUsecaseHooks(schema: Schema) {
  schema.post("save", function (doc: any) { notify(doc?.project_id); });
  schema.post("insertMany", function (docs: any) { for (const d of Array.isArray(docs) ? docs : [docs]) notify(d?.project_id); });
  schema.pre(QUERY_OPS as any, async function (this: any) {
    try {
      const u = this.getUpdate?.() ?? {};
      const keys = [...Object.keys(u).filter((k) => !k.startsWith("$")), ...Object.values(u).filter((v) => v && typeof v === "object").flatMap((v: any) => Object.keys(v))];
      this._ucProgressOnly = keys.length > 0 && keys.every((k) => USECASE_PROGRESS_ONLY.test(k));
      const f = this.getFilter?.() ?? {};
      if (f.project_id) { this._ucProject = f.project_id; return; }
      const d = await this.model.findOne(f).select("project_id").lean();
      this._ucProject = d?.project_id;
    } catch { /* best effort */ }
  });
  schema.post(QUERY_OPS as any, function (this: any, res: any) {
    if (this._ucProgressOnly) return;
    notify(res?.project_id ?? this._ucProject);
  });
}

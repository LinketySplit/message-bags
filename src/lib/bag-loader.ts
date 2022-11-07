import type { TranslatedMessageBag } from "./shared";


export class BagLoader {
  private moduleLoadFns: Record<string, () => Promise<TranslatedMessageBag>>;
  private loadedMessageBags: Record<string, TranslatedMessageBag> = {};
  private static instance: BagLoader | null = null;
  public static inst(): BagLoader {
    if (!this.instance) {
      this.instance = new BagLoader();
    }
    return this.instance;
  }
  private constructor() {
    this.moduleLoadFns = import.meta.glob('/src/i18n/**/*.ts', {
      import: 'messages'
    }) as Record<string, () => Promise<TranslatedMessageBag>>;
  }
  public async loadMessageBag(
    messageBagId: string,
    locale: string
  ): Promise<TranslatedMessageBag> {
    const bagPath = `src/i18n/${messageBagId}/${locale}.ts`;
    if (!this.loadedMessageBags[bagPath]) {
      if (!this.moduleLoadFns[bagPath]) {
        this.loadedMessageBags[bagPath] = {};
      } else {
        this.loadedMessageBags[bagPath] = await this.moduleLoadFns[bagPath]();
      }
    }
    return this.loadedMessageBags[bagPath];
  }
}
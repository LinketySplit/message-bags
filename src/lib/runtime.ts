import * as publicEnv from '$env/static/public';
import { validateEnvVariables, parseMessageId, type I18NEnv } from './shared';

type TranslatedMessageBag = {
	[messageId: string]: string | ((data: Record<string, unknown>) => string);
};

export function skint(messageId: string, def: string): (locale?: string) => Promise<string>;

export function skint<DataType extends Record<string, unknown>>(
	messageId: string,
	def: (data: DataType) => string
): (data: DataType, locale?: string) => Promise<string>;

export function skint(
	messageId: string,
	def: string | ((data: Record<string, unknown>) => string)
) {
	const { messageKey, messageBagId } = parseMessageId(messageId);
	if (typeof def === 'function') {
		const fn = async (data: Record<string, unknown>, locale?: string): Promise<string> => {
			let resolvedFn: (data: Record<string, unknown>) => string = def;
			if (locale) {
				const messageBag = await MessageLoader.inst().loadMessageBag(messageBagId, locale);
				if (typeof messageBag[messageKey] === 'function') {
					resolvedFn = messageBag[messageKey] as typeof def;
				}
			}
			return resolvedFn(data);
		};
		return fn;
	}
	const fn = async (locale?: string): Promise<string> => {
		let resolved: string = def;
		if (locale) {
			const messageBag = await MessageLoader.inst().loadMessageBag(messageBagId, locale);
			resolved =
				typeof messageBag[messageKey] === 'string' ? (messageBag[messageKey] as string) : def;
		}
		return resolved;
	};
	return fn;
}
const test = skint('test.string', 'hollo');
const test2 = skint('test.fn', (data: { name: string }) => `Hello, ${data.name}`);

class MessageLoader {
	private env: I18NEnv;
	private moduleLoadFns: Record<string, () => Promise<TranslatedMessageBag>>;
	private loadedMessageBags: Record<string, TranslatedMessageBag> = {};
	private static instance: MessageLoader | null = null;
	public static inst(): MessageLoader {
		if (!this.instance) {
			this.instance = new MessageLoader();
		}
		return this.instance;
	}
	private constructor() {
		this.env = validateEnvVariables(publicEnv);
		this.moduleLoadFns = import.meta.glob(this.env.i18nSrcFolder + '/**/*.ts', {
			import: 'messages'
		}) as Record<string, () => Promise<TranslatedMessageBag>>;
	}
	public async loadMessageBag(messageBagId: string, locale: string): Promise<TranslatedMessageBag> {
		const bagPath = `${this.env.i18nSrcFolder}/${messageBagId}/${locale}.ts`;
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

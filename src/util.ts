export const trimStart = (str: string, char: string): string => {
    const { length } = str;
    let i = 0;
    for (; i < length; ++i) {
        if (str[i] !== char) break;
    }
    return i > 0 ? str.slice(i) : str;
};

export const trimEnd = (str: string, char: string): string => {
    const l = str.length - 1;
    let i = l;
    for (; i >= 0; --i) {
        if (str[i] !== char) break;
    }
    return i < l ? str.slice(0, i + 1) : str;
};

/* istanbul ignore if -- @preserve */
if (import.meta.vitest) {
    const { it, expect } = import.meta.vitest;

    it('trim', () => {
        expect(trimStart('', '0')).toBe('');
        expect(trimStart('0', '0')).toBe('');
        expect(trimStart('1', '0')).toBe('1');
        expect(trimStart('123', '0')).toBe('123');
        expect(trimStart('0123', '0')).toBe('123');
        expect(trimStart('00123', '0')).toBe('123');

        expect(trimEnd('', '0')).toBe('');
        expect(trimEnd('0', '0')).toBe('');
        expect(trimEnd('1', '0')).toBe('1');
        expect(trimEnd('123', '0')).toBe('123');
        expect(trimEnd('1230', '0')).toBe('123');
        expect(trimEnd('12300', '0')).toBe('123');
    });
}

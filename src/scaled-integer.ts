import { trimEnd, trimStart } from './util.js';

const STRICT_DECIMAL_REGEX = /^(?<sign>[-+]?)(?<major>[0-9]+)(\.(?<minor>[0-9]+))?$/;
const LAX_DECIMAL_REGEX = /^(?<sign>[-+]?)(?<major>[0-9]*)(\.(?<minor>[0-9]*))?$/;

export class ScaledInteger {
    private _value: number;
    private _scale: number;

    constructor(value: number, scale: number = 0) {
        if (!Number.isSafeInteger(value)) throw Error('unsafe integer value');
        if (!Number.isSafeInteger(scale)) throw Error('unsafe integer value');
        if (scale < 0) throw Error('scale must be a positive integer');
        this._value = value;
        this._scale = scale;
    }

    static deserialize(input: { value: number; scale: number }): ScaledInteger {
        const { value, scale } = input;
        return new ScaledInteger(value, scale);
    }

    static parse(str: string): ScaledInteger {
        const groups = str.match(STRICT_DECIMAL_REGEX)?.groups;
        if (!groups) {
            throw new Error('invalid decimal string');
        }
        const sign = groups['sign']!;
        const majorStr = trimStart(groups['major']!, '0') || '0';
        const minorStr = trimEnd(groups['minor'] ?? '', '0') || '0';
        const major = +majorStr;
        const minor = +minorStr;
        const scale = minor === 0 ? 0 : minorStr.length;
        const value = major * 10 ** scale + minor;
        return new ScaledInteger(sign == '-' ? -value : value, scale);
    }

    // Useful for parsing user inputs
    static parseLax(str: string): ScaledInteger {
        const groups = str.match(LAX_DECIMAL_REGEX)?.groups;
        if (!groups) {
            throw new Error('invalid decimal string');
        }
        const sign = groups['sign']!;
        const majorStr = trimStart(groups['major']!, '0') || '0';
        const minorStr = trimEnd(groups['minor'] ?? '', '0') || '0';
        const major = +majorStr;
        const minor = +minorStr;
        const scale = minorStr.length;
        const value = major * 10 ** scale + minor;
        return new ScaledInteger(sign == '-' ? -value : value, scale);
    }

    static normalizedValues(a: ScaledInteger, b: ScaledInteger): [[number, number], number] {
        const { _value: aValue, _scale: aScale } = a;
        const { _value: bValue, _scale: bScale } = b;
        let lhs: number;
        let rhs: number;
        if (aScale < bScale) {
            lhs = a._unsafelyGetRelativeValue(bScale);
            rhs = bValue;
            return [[lhs, rhs], bScale];
        } else {
            lhs = aValue;
            rhs = b._unsafelyGetRelativeValue(aScale);
            return [[lhs, rhs], aScale];
        }
    }

    static maximumScale<Args extends ScaledInteger[]>(
        first: ScaledInteger,
        ...values: Args
    ): [number, ScaledInteger] {
        const { length } = values;
        let max: ScaledInteger = first;
        let maxScale = max._scale;
        let i = 1;
        for (; i < length; ++i) {
            const item = values[i]!;
            const itemScale = item._scale;
            if (itemScale > maxScale) {
                max = item;
                maxScale = itemScale;
            }
        }
        return [i, max];
    }

    static normalize<Args extends ScaledInteger[]>(...values: Args): Args {
        const { length } = values;
        if (length === 0) return [] as ScaledInteger[] as Args;
        const [maxIndex, max] = this.maximumScale(values[0]!, ...values.slice(1));
        const output: ScaledInteger[] = [];
        for (let i = 0; i < length; ++i) {
            let item = values[i]!;
            if (i === maxIndex) {
                output.push(item);
            } else {
                const cloned = item.clone().normalizeTo(max);
                output.push(cloned);
            }
        }
        return output as Args;
    }

    static equal(a: ScaledInteger, b: ScaledInteger): boolean {
        const { _scale: aScale } = a;
        const { _scale: bScale } = b;
        if (aScale > bScale) {
            return a._value === b._unsafelyGetRelativeValue(aScale);
        } else {
            return a._unsafelyGetRelativeValue(bScale) === b._value;
        }
    }

    static compare(a: ScaledInteger, b: ScaledInteger): -1 | 0 | 1 {
        const { _scale: aScale } = a;
        const { _scale: bScale } = b;
        if (aScale > bScale) {
            const aValue = a._value;
            const bValue = b._unsafelyGetRelativeValue(aScale);
            return aValue < bValue ? -1 : aValue === bValue ? 0 : +1;
        } else {
            const aValue = a._unsafelyGetRelativeValue(bScale);
            const bValue = b._value;
            return aValue < bValue ? -1 : aValue === bValue ? 0 : +1;
        }
    }

    static lessThan(a: ScaledInteger, b: ScaledInteger): boolean {
        return this.compare(a, b) === -1;
    }

    static lessThanOrEqual(a: ScaledInteger, b: ScaledInteger): boolean {
        const c = this.compare(a, b);
        return c === 0 || c === -1;
    }

    static greaterThanOrEqual(a: ScaledInteger, b: ScaledInteger): boolean {
        const c = this.compare(a, b);
        return c === 0 || c === +1;
    }

    static greaterThan(a: ScaledInteger, b: ScaledInteger): boolean {
        return this.compare(a, b) === +1;
    }

    static divide(_a: ScaledInteger, _b: ScaledInteger): [number, number] {
        throw Error('todo');
    }

    get value() {
        return this._value;
    }

    get scale() {
        return this._scale;
    }

    clone(): ScaledInteger {
        const { _value, _scale } = this;
        return new ScaledInteger(_value, _scale);
    }

    getRelativeValue(other: ScaledInteger): number {
        const { _value, _scale } = this;
        const otherScale = other._scale;
        if (_scale < otherScale) {
            throw Error('other scale must be greater');
        }
        return _value * 10 ** (otherScale - _scale);
    }

    private _unsafelyGetRelativeValue(otherScale: number): number {
        const { _value, _scale } = this;
        return _value * 10 ** (otherScale - _scale);
    }

    isZero() {
        return this._value === 0;
    }

    isPositive() {
        return this._value > 0;
    }

    isNegative() {
        return this._value < 0;
    }

    hasSubUnits() {
        const { _value, _scale } = this;
        const minor = _value % 10 ** _scale;
        return minor !== 0;
    }

    toUnits(): [number, number] {
        const { _value, _scale } = this;
        const minor = _value % 10 ** _scale;
        const major = (_value - minor) / 10 ** _scale;
        return [major, Math.abs(minor)];
    }

    toString(): string {
        const [major, minor] = this.toUnits();
        if (minor === 0) {
            return major.toString();
        } else {
            const zerosign = major === 0 && this._value < 0 ? '-' : '';
            return `${zerosign}${major}.${minor.toString().padStart(this._scale, '0')}`;
        }
    }

    toLossyNumber(): number {
        return this._value / 10 ** this._scale;
    }

    normalizeTo(other: ScaledInteger) {
        const otherScale = other._scale;
        if (this._scale < otherScale) {
            this.transformScale(otherScale);
        }
        return this;
    }

    increaseScale(scaleIncrement: number) {
        const { _value } = this;
        this._value = _value * 10 ** scaleIncrement;
        this._scale += scaleIncrement;
        return this;
    }

    transformScale(newScale: number) {
        const { _value, _scale } = this;
        if (newScale > _scale) {
            return this.increaseScale(newScale - _scale);
        }
        const truncatedScale = _scale - newScale;
        const truncated = _value % 10 ** truncatedScale;
        this._value = Math.floor((_value - truncated) / 10 ** truncatedScale);
        this._scale = newScale;
        return truncated;
    }

    trimScale() {
        const { _value, _scale } = this;
        let i = 0;
        for (; i < _scale; ++i) {
            const x = _value % 10 ** (i + 1);
            if (x !== 0) {
                break;
            }
        }
        this._value = _value / 10 ** i;
        this._scale -= i;
        return this;
    }

    add(other: ScaledInteger): ScaledInteger {
        const [[lhs, rhs], scale] = ScaledInteger.normalizedValues(this, other);
        const value = lhs + rhs;
        if (!Number.isSafeInteger(value)) {
            throw Error('addition overflow');
        }
        this._value = value;
        this._scale = scale;
        return this;
    }

    subtract(other: ScaledInteger): ScaledInteger {
        const [[lhs, rhs], scale] = ScaledInteger.normalizedValues(this, other);
        const value = lhs + rhs;
        if (!Number.isSafeInteger(value)) {
            throw Error('subtraction overflow');
        }
        this._value = value;
        this._scale = scale;
        return this;
    }

    multiply(other: ScaledInteger): ScaledInteger {
        const [[lhs, rhs], scale] = ScaledInteger.normalizedValues(this, other);
        const value = lhs + rhs;
        if (!Number.isSafeInteger(value)) {
            throw Error('multiplication overflow');
        }
        this._value = value;
        this._scale = scale;
        return this;
    }

    quotient(_other: ScaledInteger): ScaledInteger {
        throw Error('todo');
    }

    remainder(_other: ScaledInteger): ScaledInteger {
        throw Error('todo');
    }

    toJSON(): any {
        const { _value: value, _scale: scale } = this;
        return { value, scale };
    }
}

/* istanbul ignore if -- @preserve */
if (import.meta.vitest) {
    const { it, expect } = import.meta.vitest;

    it('only accepts safe integers', () => {
        const maxSafeIntegerPlus1 = Number.MAX_SAFE_INTEGER + 1;

        expect(() => new ScaledInteger(maxSafeIntegerPlus1).toString()).toThrow();
        expect(() => new ScaledInteger(0, maxSafeIntegerPlus1).toString()).toThrow();
        expect(() => ScaledInteger.parse(maxSafeIntegerPlus1 + '').toString()).toThrow();

        expect(() => new ScaledInteger(0, -1).toString()).toThrow();
        expect(() => new ScaledInteger(0, 0.1).toString()).toThrow();
        expect(() => new ScaledInteger(0.1, 0).toString()).toThrow();
    });

    it('strict parsing', () => {
        expect(() => ScaledInteger.parse('..').toString()).toThrow();
        expect(() => ScaledInteger.parse('.').toString()).toThrow();
        expect(() => ScaledInteger.parse('0.').toString()).toThrow();
        expect(() => ScaledInteger.parse('.0').toString()).toThrow();

        expect(ScaledInteger.parse('0').toString()).toBe('0');
        expect(ScaledInteger.parse('+0').toString()).toBe('0');
        expect(ScaledInteger.parse('-0').toString()).toBe('0');

        expect(ScaledInteger.parse('1.0').toString()).toBe('1');
        expect(ScaledInteger.parse('+1.0').toString()).toBe('1');
        expect(ScaledInteger.parse('-1.0').toString()).toBe('-1');

        expect(ScaledInteger.parse('0.1').toString()).toBe('0.1');
        expect(ScaledInteger.parse('+0.1').toString()).toBe('0.1');
        expect(ScaledInteger.parse('-0.1').toString()).toBe('-0.1');

        expect(ScaledInteger.parse('0.1234').toString()).toBe('0.1234');
        expect(ScaledInteger.parse('0.0001').toString()).toBe('0.0001');
        expect(ScaledInteger.parse('1234.0001').toString()).toBe('1234.0001');
        expect(ScaledInteger.parse('1234').toString()).toBe('1234');

        expect(ScaledInteger.parse('+0.1234').toString()).toBe('0.1234');
        expect(ScaledInteger.parse('+0.0001').toString()).toBe('0.0001');
        expect(ScaledInteger.parse('+1234.0001').toString()).toBe('1234.0001');
        expect(ScaledInteger.parse('+1234').toString()).toBe('1234');

        expect(ScaledInteger.parse('-0.1234').toString()).toBe('-0.1234');
        expect(ScaledInteger.parse('-0.0001').toString()).toBe('-0.0001');
        expect(ScaledInteger.parse('-1234.0001').toString()).toBe('-1234.0001');
        expect(ScaledInteger.parse('-1234').toString()).toBe('-1234');

        expect(ScaledInteger.parseLax('00010.0001000').toString()).toBe('10.0001');
        expect(ScaledInteger.parseLax('00010.0001').toString()).toBe('10.0001');
        expect(ScaledInteger.parseLax('10.0001000').toString()).toBe('10.0001');
    });

    it('lax parsing (superset of strict parsing)', () => {
        expect(() => ScaledInteger.parseLax('..').toString()).toThrow();
        expect(ScaledInteger.parseLax('.').toString()).toBe('0');
        expect(ScaledInteger.parseLax('0.').toString()).toBe('0');
        expect(ScaledInteger.parseLax('.0').toString()).toBe('0');

        expect(ScaledInteger.parseLax('0').toString()).toBe('0');
        expect(ScaledInteger.parseLax('+0').toString()).toBe('0');
        expect(ScaledInteger.parseLax('-0').toString()).toBe('0');

        expect(ScaledInteger.parseLax('1.0').toString()).toBe('1');
        expect(ScaledInteger.parseLax('+1.0').toString()).toBe('1');
        expect(ScaledInteger.parseLax('-1.0').toString()).toBe('-1');

        expect(ScaledInteger.parseLax('0.1').toString()).toBe('0.1');
        expect(ScaledInteger.parseLax('+0.1').toString()).toBe('0.1');
        expect(ScaledInteger.parseLax('-0.1').toString()).toBe('-0.1');

        expect(ScaledInteger.parseLax('0.1234').toString()).toBe('0.1234');
        expect(ScaledInteger.parseLax('0.0001').toString()).toBe('0.0001');
        expect(ScaledInteger.parseLax('1234.0001').toString()).toBe('1234.0001');
        expect(ScaledInteger.parseLax('1234').toString()).toBe('1234');

        expect(ScaledInteger.parseLax('+0.1234').toString()).toBe('0.1234');
        expect(ScaledInteger.parseLax('+0.0001').toString()).toBe('0.0001');
        expect(ScaledInteger.parseLax('+1234.0001').toString()).toBe('1234.0001');
        expect(ScaledInteger.parseLax('+1234').toString()).toBe('1234');

        expect(ScaledInteger.parseLax('-0.1234').toString()).toBe('-0.1234');
        expect(ScaledInteger.parseLax('-0.0001').toString()).toBe('-0.0001');
        expect(ScaledInteger.parseLax('-1234.0001').toString()).toBe('-1234.0001');
        expect(ScaledInteger.parseLax('-1234').toString()).toBe('-1234');

        expect(ScaledInteger.parseLax('00010.0001000').toString()).toBe('10.0001');
        expect(ScaledInteger.parseLax('00010.0001').toString()).toBe('10.0001');
        expect(ScaledInteger.parseLax('10.0001000').toString()).toBe('10.0001');
    });

    it('lax parsing', () => {
        expect(ScaledInteger.parseLax('').toString()).toBe('0');
        expect(ScaledInteger.parseLax('-').toString()).toBe('0');
        expect(ScaledInteger.parseLax('-.').toString()).toBe('0');
        expect(ScaledInteger.parseLax('-.0').toString()).toBe('0');
        expect(ScaledInteger.parseLax('-.01').toString()).toBe('-0.01');

        expect(ScaledInteger.parseLax('+').toString()).toBe('0');
        expect(ScaledInteger.parseLax('+.').toString()).toBe('0');
        expect(ScaledInteger.parseLax('+.0').toString()).toBe('0');
        expect(ScaledInteger.parseLax('+.01').toString()).toBe('0.01');

        expect(ScaledInteger.parseLax('1').toString()).toBe('1');
        expect(ScaledInteger.parseLax('1.').toString()).toBe('1');
        expect(ScaledInteger.parseLax('1.0').toString()).toBe('1');
        expect(ScaledInteger.parseLax('1.01').toString()).toBe('1.01');
    });

    it('normalizes', () => {
        const a = ScaledInteger.parse('100');
        const b = ScaledInteger.parse('10.01');
        const c = ScaledInteger.parse('1.0001');

        expect(a.scale).toBe(0);
        expect(b.scale).toBe(2);
        expect(c.scale).toBe(4);

        const [x, y, z] = ScaledInteger.normalize(a, b, c);

        expect(x.scale).toBe(4);
        expect(y.scale).toBe(4);
        expect(z.scale).toBe(4);
    });

    it('clones', () => {
        const a = ScaledInteger.parse('123.456');
        const b = a.clone();
        expect(a).toEqual(b);
    });

    it('has sub-units', () => {
        expect(ScaledInteger.parse('123.456').hasSubUnits()).toBe(true);
        expect(ScaledInteger.parse('123.456').toUnits()).toEqual([123, 456]);
        expect(ScaledInteger.parse('123.0').hasSubUnits()).toBe(false);
        expect(ScaledInteger.parse('123.0').toUnits()).toEqual([123, 0]);
    });

    it('can be converted to a number', () => {
        expect(ScaledInteger.parse('123.456').toLossyNumber()).toEqual(123.456);
    });

    it('scales', () => {
        const a = ScaledInteger.parse('123.456');
        expect(a.value).toEqual(123456);
        expect(a.scale).toEqual(3);

        a.increaseScale(3);
        expect(a.value).toEqual(123456000);
        expect(a.scale).toEqual(6);

        a.trimScale();
        expect(a.value).toEqual(123456);
        expect(a.scale).toEqual(3);

        const t0 = a.transformScale(1);
        expect(t0).toEqual(56);
        expect(a.value).toEqual(1234);
        expect(a.scale).toEqual(1);

        const t1 = a.transformScale(0);
        expect(t1).toEqual(4);
        expect(a.value).toEqual(123);
        expect(a.scale).toEqual(0);
    });

    it('increasing and transforming scales can be the same', () => {
        const b = ScaledInteger.parse('123.456');
        const c = ScaledInteger.parse('123.456');
        b.increaseScale(3);
        c.transformScale(6);

        expect(b).toEqual(c);
    });

    it('serializes to json', () => {
        const a = ScaledInteger.parse('123.456');
        expect(a.toJSON()).toEqual({ value: 123456, scale: 3 });
    });

    it('equality', () => {
        const a = ScaledInteger.parse('123.456');
        const b = ScaledInteger.parse('123.456');
        const c = ScaledInteger.parse('654.321');

        expect(ScaledInteger.equal(a, a)).toBe(true);
        expect(ScaledInteger.equal(a, b)).toBe(true);
        expect(ScaledInteger.equal(a, c)).toBe(false);
    });

    it('comparison', () => {
        const a = ScaledInteger.parse('1000');
        const b = ScaledInteger.parse('1.01');
        const c = ScaledInteger.parse('0.00001');

        expect(ScaledInteger.lessThan(b, a)).toBe(true);
        expect(ScaledInteger.lessThan(a, a)).toBe(false);

        expect(ScaledInteger.lessThanOrEqual(a, a)).toBe(true);
        expect(ScaledInteger.lessThanOrEqual(a, c)).toBe(false);

        expect(ScaledInteger.greaterThanOrEqual(b, b)).toBe(true);
        expect(ScaledInteger.greaterThanOrEqual(b, a)).toBe(false);

        expect(ScaledInteger.greaterThan(a, c)).toBe(true);
        expect(ScaledInteger.greaterThan(c, a)).toBe(false);
    });

    it('1 + 1 = 2', () => {
        const a = ScaledInteger.parse('1');
        const b = ScaledInteger.parse('1');
        const r = a.clone().add(b);
        expect(r.toString()).toEqual('2');
    });

    it('addition', () => {
        const values: [string, string, string][] = [
            ['-2741356179', '1293482756', '-1447873423'],
            ['5832719482', '3271918574', '9104638056'],
            ['-9345178210', '8932145678', '-413032532'],
            ['1983671491', '982312974', '2965984465'],
            ['-4593289392', '2415678239', '-2177611153'],
            ['6417923574', '3715284972', '10133208546'],
            ['-7185374910', '6892341875', '-293033035'],
            ['3582193428', '1874926510', '5457119938'],
            ['-8925819312', '7932156418', '-993662894'],
            ['4192583747', '2384715239', '6577298986'],

            ['1.74291456', '-0.53168294', '1.21123162'],
            ['0.18723942', '-1.61489273', '-1.42765331'],
            ['1.51294376', '-0.29384719', '1.21909657'],
            ['-0.83561427', '1.27459182', '0.43897755'],
            ['0.96427143', '1.13749251', '2.10176394'],
            ['-0.47283916', '0.89231476', '0.4194756'],
            ['0.32476129', '-1.67238491', '-1.34762362'],
            ['-1.28749152', '1.54729163', '0.25980011'],
            ['-0.17391648', '0.73262841', '0.55871193'],
            ['1.89412916', '-1.23876148', '0.65536768'],
        ];

        for (const [x, y, answer] of values) {
            const a = ScaledInteger.parse(x);
            const b = ScaledInteger.parse(y);
            const r = a.clone().add(b).trimScale();
            expect(r.toString()).toEqual(answer);
        }
    });
}

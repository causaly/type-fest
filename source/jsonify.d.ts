import type {JsonPrimitive, JsonValue} from './basic';

// Note: The return value has to be `any` and not `unknown` so it can match `void`.
type NotJsonable = ((...args: any[]) => any) | undefined;

// Note: Handles special case where Arrays with `undefined` are transformed to `'null'` by `JSON.stringify()`
// Only use with array members
type JsonifyArrayMember<T> =
	T extends undefined ?
		null | Exclude<T, undefined> :
		Jsonify<T>;

/**
Transform a type to one that is assignable to the `JsonValue` type.

This includes:
1. Transforming JSON `interface` to a `type` that is assignable to `JsonValue`.
2. Transforming non-JSON value that is *jsonable* to a type that is assignable to `JsonValue`, where *jsonable* means the non-JSON value implements the `.toJSON()` method that returns a value that is assignable to `JsonValue`.

@remarks

An interface cannot be structurally compared to `JsonValue` because an interface can be re-opened to add properties that may not be satisfy `JsonValue`.

@example
```
import type {Jsonify} from 'type-fest';

interface Geometry {
	type: 'Point' | 'Polygon';
	coordinates: [number, number];
}

const point: Geometry = {
	type: 'Point',
	coordinates: [1, 1]
};

const problemFn = (data: JsonValue) => {
	// Does something with data
};

problemFn(point); // Error: type Geometry is not assignable to parameter of type JsonValue because it is an interface

const fixedFn = <T>(data: Jsonify<T>) => {
	// Does something with data
};

fixedFn(point); // Good: point is assignable. Jsonify<T> transforms Geometry into value assignable to JsonValue
fixedFn(new Date()); // Error: As expected, Date is not assignable. Jsonify<T> cannot transforms Date into value assignable to JsonValue
```

Non-JSON values such as `Date` implement `.toJSON()`, so they can be transformed to a value assignable to `JsonValue`:

@example
```
import type {Jsonify} from 'type-fest';

const time = {
	timeValue: new Date()
};

// `Jsonify<typeof time>` is equivalent to `{timeValue: string}`
const timeJson = JSON.parse(JSON.stringify(time)) as Jsonify<typeof time>;
```

@link https://github.com/Microsoft/TypeScript/issues/1897#issuecomment-710744173

@category JSON
*/
type Jsonify<T> =
	// Check if there are any non-JSONable types represented in the union.
	// Note: The use of tuples in this first condition side-steps distributive conditional types
	// (see https://github.com/microsoft/TypeScript/issues/29368#issuecomment-453529532)
	[Extract<T, NotJsonable>] extends [never]
		? T extends JsonPrimitive
			? T // Primitive is acceptable
			: T extends Array<infer U>
				? Array<JsonifyArrayMember<U>> // It's an array: recursive call for its children
				: T extends object
					? T extends {toJSON(): infer J}
						? (() => J) extends (() => JsonValue) // Is J assignable to JsonValue?
							? J // Then T is Jsonable and its Jsonable value is J
							: never // Not Jsonable because its toJSON() method does not return JsonValue
						: {[P in keyof T]: Jsonify<Required<T>[P]>} // It's an object: recursive call for its children
					: never // Otherwise any other non-object is removed
		: never; // Otherwise non-JSONable type union was found not empty

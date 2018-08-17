# Leaflet.TileLayer.GL

A [LeafletJS](http://www.leafletjs.com) plugin to appy WebGL shaders to your tiles.

With this plugin, you can apply colour transforms to your tiles, merge two or
more tiles with a custom function, perform on-the-fly hillshading, or create synthetic
tile layers based only on the map coordinates.

## Demos


**See several examples and edit them in the [interactive editable demo](http://ivansanchez.gitlab.io/Leaflet.TileLayer.GL/demo/repl.html)!**

The interactive editable demo includes the code for the following, which you can also see individually:

* [Basic colour inversion](http://ivansanchez.gitlab.io/Leaflet.TileLayer.GL/demo/demo-antitoner.html): This demo loads the ["toner" map style by Stamen](http://maps.stamen.com/toner/) and changes the colours on-the-fly.
* [Conditional colouring](http://ivansanchez.gitlab.io/Leaflet.TileLayer.GL/demo/demo-tropical.html): This demo loads the ["toner" map style by Stamen](http://maps.stamen.com/toner/) and changes the colours on-the-fly, depending on the latitude of each pixel. This highlights the tropics and arctic circles.
* [Flood & height](http://ivansanchez.gitlab.io/Leaflet.TileLayer.GL/demo/demo-flood.html): This demo uses [MapBox's "Terrain-RGB" tiles](https://www.mapbox.com/blog/terrain-rgb/) to play with the elevation: areas are coloured depending to the elevation (below 0 meters, between 0 and 5 meters, between 5 and 10 meters, above 10 meters).
* [Hypsometric tint](http://ivansanchez.gitlab.io/Leaflet.TileLayer.GL/demo/demo-hypsometric.html): This demo uses [MapBox's "Terrain-RGB" tiles](https://www.mapbox.com/blog/terrain-rgb/) and applies a basic [hypsometric tint](https://en.wikipedia.org/wiki/Hypsometric_tints) colour ramp.

Besides those, the [Mandelbrot set demo](http://ivansanchez.gitlab.io/Leaflet.TileLayer.GL/demo/demo-mandelbrot.html) uses a map with `L.CRS.Simple` coordinates and no tiles at all, to draw a fractal set.

The interactive demo includes the following, which doesn't have a stand-alone demo:
* Hue rotation (converts RGB colour space to HSV, modifies the hue, converts back)

## Why?

Leaflet has been lagging behind when it comes to WebGL technology. Other map libraries (such as [OpenLayers 3]() and most notably [Tangram](https://mapzen.com/products/tangram/)) can already use WebGL shaders to apply transformations to map tiles and do fancy stuff.

The inflexion point are [MapBox's "Terrain-RGB" tiles](https://www.mapbox.com/blog/terrain-rgb/). WebGL manipulation of these tiles can provide real-time terrain relief and hill shading.

This takes some inspiration from [shadertoy.com](http://www.shadertoy.com), in the sense that the shaders work on two triangles with some predefined attributes and uniforms.

## Compatibility

Leaflet 1.0.3 (or newer), and a web browser that supports both [WebGL](http://caniuse.com/#search=webgl) and [ES6 `Promise`s](http://caniuse.com/#search=promise). You can also use a `Promise` polyfill for IE11.

## Usage

Include Leaflet and Leaflet.TileLayer.GL in your HTML:

```
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.0.3/dist/leaflet.css"
  integrity="sha512-07I2e+7D8p6he1SIM+1twR5TIrhUQn9+I6yjqD53JQjFiMf8EtC93ty0/5vJTZGF8aAocvHYNEDJajGdNx1IsQ=="
  crossorigin=""/>
<script src="https://unpkg.com/leaflet@1.0.3/dist/leaflet-src.js"
  integrity="sha512-WXoSHqw/t26DszhdMhOXOkI7qCiv5QWXhH9R7CgvgZMHz1ImlkVQ3uNsiQKu5wwbbxtPzFXd1hK4tzno2VqhpA=="
  crossorigin=""></script>
<script src='https://unpkg.com/leaflet.tilelayer.gl@latest/src/Leaflet.TileLayer.GL'></script>
```

Alternatively, fetch a local copy of Leaflet and Leaflet.TileLayer.GL with `npm install --save leaflet; npm install --save leaflet.tilelayer.gl` or `yarn add leaflet; yarn add leaflet.tilelayer.gl`

You can create instances of `L.TileLayer.GL` in your code. These take two new options: `fragmentShader` and `tileUrls`, e.g.:

```
	var antitoner = L.tileLayer.gl({
		fragmentShader: "// String with GLSL fragment shader code",
		tileUrls: ['http://{s}.tile.stamen.com/toner/{z}/{x}/{y}.png']
	}).addTo(map);
```

Using this plugin requires some knowledge of WebGL and GLSL shaders. If you've never heard the terms "vertex shader" or "fragment shader", read [this WebGL tutorial](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Getting_started_with_WebGL) to become acquinted, or [The Book Of Shaders](https://thebookofshaders.com/) to learn to do cool shaders, or [WebGL Fundamentals](http://webglfundamentals.org/webgl/lessons/webgl-image-processing.html) to see some WebGL image processing techniques.

The `fragmentShader` option contain shader code, in a string. For every map tile, two triangles are created, a simple vertex shader runs to copy data and fill the values for the _varyings_, and the fragment shader runs once on every pixel (to be precise, on every _fragment_). This plugin does not allow you to create more triangles, and does not allow to create animations.

The fragment shader receives the following **varyings**:

* `vLatLngCoords`: a `vec2` containing the *map data* coordinates for the vertices (with values like `LatLng`s).
* `vCRSCoords`: a `vec2` containing the *map display* coordinates for the vertices (with values for the map CRS).
* `vTextureCoords`: a `vec2` containing the *texture* coordinates for the vertices. Use this for fetching texels.

It also receives the following **uniforms**:

* `uTexture0`: a `sampler2D` referring to the first loaded tile image. This exists only if the `tileUrls` option is not empty.
* `uTexture1`..`uTexture7`: texture samplers for the 2nd through 8th image.

## Demo shaders

This is the code used in the "antitoner" demo, commented and explained:

```js
// Create the fragment shader as a multi-line string. Note the "`" character, valid only in ES6 JavaScript.
// Shaders can be defined elsewhere, or loaded from other files or from the network,
// but they must be strings when used in a TileLayer.GL.

// You need to *not* define the varyings and uniforms. L.TileLayer.GL does that for you.
// // precision highp float;
// // uniform sampler2D uTexture0;	// This contains a reference to the tile image loaded from the network
// // varying vec2 vTextureCoords;	// This is the interpolated texel coords for this fragment

var antiTonerFragmentShader = `
	void main(void) {
		// Classic texel look-up (fetch the texture "pixel" color for this fragment)
		vec4 texelColour = texture2D(uTexture0, vec2(vTextureCoords.s, vTextureCoords.t));

		// If uncommented, this would output the image "as is"
		// gl_FragColor = texelColour;

		// Let's mix the colours a little bit, inverting the red and green channels.
		gl_FragColor = vec4(1.0 - texelColour.rg, texelColour.b, 1.0);
	}
`

// Instantiate our L.TileLayer.GL...
var antitoner = L.tileLayer.gl({
	// ... with the shader we just wrote above...
	fragmentShader: antiTonerFragmentShader,

	// ...and loading tile images from Stamen Toner as "uTexture0".
	// If this array contained more than one tile template string,
	// there would be "uTexture1", "uTexture2" and so on.
	tileUrls: ['http://{s}.tile.stamen.com/toner/{z}/{x}/{y}.png']
}).addTo(map);
```

Find more examples in the [interactive demo](http://ivansanchez.gitlab.io/Leaflet.TileLayer.GL/demo/repl.html).

## Cool things that should be doable, but nobody has yet shown interest in asking about, much less in implementing them

* Updating the shaders
* Reusing the same WebGL context for more than one `TileLayer.GL` (as the render
  calls are sync)
* Custom uniforms
* Time uniform(s)
* Some kind of animations (keep the loaded images in memory, implement a rendering
  loop)

## Legalese

----------------------------------------------------------------------------

"THE BEER-WARE LICENSE":
<ivan@sanchezortega.es> wrote this file. As long as you retain this notice you
can do whatever you want with this stuff. If we meet some day, and you think
this stuff is worth it, you can buy me a beer in return.

----------------------------------------------------------------------------


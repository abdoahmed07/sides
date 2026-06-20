# Ray Tracer (C++)

A physically-based ray tracer implemented from scratch in C++, following the
[Ray Tracing in One Weekend](https://raytracing.github.io) series (Books 1, 2, and 3).
No graphics libraries — just math, vectors, and pixels written to a PPM file.

## Renders

**Book 1 Final Scene** — hundreds of random spheres with diffuse, metal, and glass materials,
depth of field:

*(render image here — see `renders/book1_final.ppm`)*

**Book 2 Cornell Box** — classic computer graphics test scene with area lights and global
illumination:

*(render image here — see `renders/book2_cornell_box.ppm`)*

## Building

```bash
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build . --config Release

# Render the final scene (takes a few minutes at high sample count)
./raytracer > ../renders/output.ppm

# Convert to PNG (requires ImageMagick)
convert ../renders/output.ppm ../renders/output.png
```

## Features

### Book 1 — Foundations
- Vec3 class with dot product, cross product, reflection, refraction
- Ray-sphere intersection via quadratic formula
- Lambertian (matte) materials with proper diffuse scatter distribution
- Metal materials with configurable fuzz for brushed effects
- Dielectric (glass) with Snell's law refraction and Schlick's Fresnel approximation
- Multi-sample anti-aliasing (configurable samples per pixel)
- Depth of field / defocus blur via thin lens approximation

### Book 2 — Advanced
- Motion blur (moving spheres with time-averaged sampling)
- Bounding Volume Hierarchy (BVH) — dramatically speeds up large scenes by partitioning space
- Checker and Perlin noise textures
- Rectangle lights (area lighting)
- Cornell Box scene
- Volumes / participating media (smoke, fog)

### Book 3 — Monte Carlo
- Probability density functions for importance sampling
- Cosine-weighted hemisphere sampling for Lambertian surfaces
- Light importance sampling for faster convergence

### Custom Feature — OBJ File Loader
I added support for loading `.obj` mesh files. The loader parses vertex positions and face
definitions, triangulates each face, and inserts the triangles as hittable objects.
This lets me render arbitrary geometry exported from Blender.

```bash
./raytracer --obj ../models/bunny.obj > ../renders/bunny.ppm
```

## What I learned

**The rendering equation.** Each recursive call in `ray_color()` is computing one term of
the rendering equation: how much light arrives at a point from a given direction. The
recursion terminates at light sources (the background gradient acts as an environment light).

**BVH is the most important optimization.** Before BVH, rendering a scene with 1,000 objects
required testing every ray against all 1,000. After BVH, it's O(log n). The Book 2 final scene
went from ~20 minutes to ~3 minutes to render.

**Importance sampling matters more than I expected.** In Book 3, switching from uniform
hemisphere sampling to cosine-weighted sampling halved the noise at the same sample count.
This is the same principle behind MCMC methods in machine learning — smarter sampling means
faster convergence.

**Math on paper first.** Every time I tried to code before understanding the derivation (the
Snell's law refraction, the Schlick approximation, the BVH bounding box construction), I got
it wrong. Writing it out by hand first made the code straightforward.

## Technical decisions

**Why C++:** The book uses C++ and I already know it. More importantly, ray tracing is
compute-intensive — the final scene with 500 samples per pixel takes several minutes even in
optimized C++. Python would be 10-100x slower, which would make iteration painful.

**Why PPM output:** PPM is the simplest possible image format — plain text with pixel values.
No library needed, I can write it myself. Once I have the PPM, I convert to PNG with
ImageMagick.

**Why recursive ray_color instead of iterative:** The book explains this — it's cleaner for
understanding the rendering equation. A iterative path tracer would be more cache-friendly
but much harder to reason about.

cmake_minimum_required(VERSION 3.14)
project(RayTracer CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED True)

# Optimize for release — ray tracing is slow without this
set(CMAKE_CXX_FLAGS_RELEASE "-O3 -march=native")

if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()

add_executable(raytracer
  src/main.cpp
)

target_include_directories(raytracer PRIVATE src)

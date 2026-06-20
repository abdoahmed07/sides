# Week 7 — Graphs: BFS and DFS
# Most graph interview problems are variations of: find connected components,
# find shortest path, or detect cycles

from collections import deque

# ---- Problem: Number of Islands ----
# Grid of '1' (land) and '0' (water) — count connected components of '1's
# For each unvisited '1', BFS/DFS to mark the whole island as visited

def num_islands(grid: list[list[str]]) -> int:
    if not grid:
        return 0

    rows, cols = len(grid), len(grid[0])
    count = 0

    def dfs(r, c):
        # Out of bounds or water — stop
        if r < 0 or r >= rows or c < 0 or c >= cols or grid[r][c] != '1':
            return
        grid[r][c] = '#'  # mark as visited in-place (I could use a separate visited set instead)
        dfs(r+1, c); dfs(r-1, c)
        dfs(r, c+1); dfs(r, c-1)

    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == '1':
                count += 1
                dfs(r, c)

    return count


# ---- Problem: Clone Graph ----
# Deep copy a graph where each node has a val and a list of neighbors
# The tricky part: avoid infinite loops when following cycles
# Solution: keep a visited map from old node -> new node

class GraphNode:
    def __init__(self, val=0, neighbors=None):
        self.val = val
        self.neighbors = neighbors or []

def clone_graph(node: GraphNode) -> GraphNode:
    if not node:
        return None

    visited = {}  # old_node -> new_node

    def dfs(n):
        if n in visited:
            return visited[n]

        clone = GraphNode(n.val)
        visited[n] = clone  # register BEFORE processing neighbors (handles cycles)

        for neighbor in n.neighbors:
            clone.neighbors.append(dfs(neighbor))

        return clone

    return dfs(node)


# ---- Problem: Course Schedule (cycle detection) ----
# Can you finish all courses given a list of prerequisites?
# This is just: does the directed graph have a cycle?
# I use DFS with three states: unvisited, in-progress (in current path), done

def can_finish(num_courses: int, prerequisites: list[list[int]]) -> bool:
    # Build adjacency list
    adj = [[] for _ in range(num_courses)]
    for course, prereq in prerequisites:
        adj[course].append(prereq)

    # 0 = unvisited, 1 = in progress (cycle candidate), 2 = done (safe)
    state = [0] * num_courses

    def has_cycle(node):
        if state[node] == 1: return True   # visiting a node we're currently processing = cycle
        if state[node] == 2: return False  # already confirmed safe

        state[node] = 1  # mark as in progress
        for neighbor in adj[node]:
            if has_cycle(neighbor):
                return True
        state[node] = 2  # mark as done (safe)
        return False

    for i in range(num_courses):
        if has_cycle(i):
            return False

    return True


# Quick tests
if __name__ == "__main__":
    grid = [
        ["1","1","1","1","0"],
        ["1","1","0","1","0"],
        ["1","1","0","0","0"],
        ["0","0","0","0","0"],
    ]
    assert num_islands([row[:] for row in grid]) == 1
    grid2 = [
        ["1","1","0","0","0"],
        ["1","1","0","0","0"],
        ["0","0","1","0","0"],
        ["0","0","0","1","1"],
    ]
    assert num_islands([row[:] for row in grid2]) == 3
    print("Number of Islands: OK")

    # Course schedule
    assert can_finish(2, [[1, 0]]) == True          # 0 -> 1, no cycle
    assert can_finish(2, [[1, 0], [0, 1]]) == False  # cycle: 0 <-> 1
    print("Course Schedule: OK")

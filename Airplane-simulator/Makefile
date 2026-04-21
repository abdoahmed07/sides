CXX      := g++
CXXFLAGS := -std=c++17 -Wall -Wextra -O2
TARGET   := airport_sim
SRCDIR   := src
SRCS     := $(SRCDIR)/main.cpp \
            $(SRCDIR)/Runway.cpp \
            $(SRCDIR)/Airport.cpp \
            $(SRCDIR)/Simulation.cpp
OBJS     := $(SRCS:.cpp=.o)

.PHONY: all clean run

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CXX) $(CXXFLAGS) -o $@ $^

$(SRCDIR)/%.o: $(SRCDIR)/%.cpp
	$(CXX) $(CXXFLAGS) -c -o $@ $<

run: all
	./$(TARGET)

clean:
	rm -f $(SRCDIR)/*.o $(TARGET)

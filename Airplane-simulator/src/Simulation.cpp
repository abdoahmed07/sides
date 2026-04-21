#include "Simulation.h"
#include <iostream>
#include <iomanip>
#include <sstream>
#include <cstdlib>
#include <cmath>
#include <thread>
#include <chrono>
#include <algorithm>

// ─── ANSI color helpers ───────────────────────────────────────────────────────
namespace Color {
    const char* reset   = "\033[0m";
    const char* bold    = "\033[1m";
    const char* red     = "\033[31m";
    const char* green   = "\033[32m";
    const char* yellow  = "\033[33m";
    const char* blue    = "\033[34m";
    const char* magenta = "\033[35m";
    const char* cyan    = "\033[36m";
    const char* white   = "\033[37m";
    const char* grey    = "\033[90m";
}

// ─── Box-drawing helpers ──────────────────────────────────────────────────────
static const int BOX_W = 66;

static void hline(char left, char mid, char right) {
    std::cout << left;
    for (int i = 0; i < BOX_W - 2; ++i) std::cout << mid;
    std::cout << right << '\n';
}
static void row(const std::string& content) {
    // Pad or truncate to fit inside box
    std::string s = content;
    // Strip ANSI when calculating visible length (rough estimate)
    int visible = 0;
    bool inEsc  = false;
    for (char c : s) {
        if (c == '\033') { inEsc = true; continue; }
        if (inEsc) { if (c == 'm') inEsc = false; continue; }
        ++visible;
    }
    int padding = BOX_W - 4 - visible;
    if (padding < 0) padding = 0;
    std::cout << "| " << s << std::string(padding, ' ') << " |\n";
}
static void emptyRow() { row(""); }

static std::string fuelBar(int fuel) {
    int filled = fuel / 10;  // 0–10
    std::string bar;
    const char* color = (fuel < 20) ? Color::red
                      : (fuel < 40) ? Color::yellow
                      : Color::green;
    bar += color;
    for (int i = 0; i < filled;      ++i) bar += '#';
    bar += Color::grey;
    for (int i = filled; i < 10; ++i) bar += '-';
    bar += Color::reset;
    return bar;
}

static std::string progressBar(int elapsed, int total, int width = 10) {
    int filled = (total > 0) ? (elapsed * width / total) : 0;
    std::string bar;
    bar += Color::cyan;
    for (int i = 0; i < filled;      ++i) bar += '#';
    bar += Color::grey;
    for (int i = filled; i < width; ++i) bar += '-';
    bar += Color::reset;
    return bar;
}

static std::string mmss(int minutes) {
    std::ostringstream oss;
    oss << std::setw(2) << std::setfill('0') << (minutes / 60)
        << ':'
        << std::setw(2) << std::setfill('0') << (minutes % 60);
    return oss.str();
}

// ─────────────────────────────────────────────────────────────────────────────
Simulation::Simulation(SimConfig cfg)
    : _cfg(std::move(cfg))
    , _airport(_cfg.name, _cfg.numRunways)
    , _clock(0)
    , _nextPlaneId(1)
{}

// ─── Traffic generation ───────────────────────────────────────────────────────
void Simulation::_generateTraffic() {
    // Poisson-ish: each minute, generate 0 or 1 arrival / departure
    // with probability = rate/10
    auto arrives = [&]() {
        return (std::rand() % 100) < (_cfg.arrivalRate * 10);
    };
    auto departs = [&]() {
        return (std::rand() % 100) < (_cfg.departureRate * 10);
    };

    if (arrives()) {
        Plane p = Plane::createArrival(_nextPlaneId++, _clock);
        _airport.addArrival(p);
        _logEvent(std::string(Color::cyan) + "+" + Color::reset +
                  " Arrival   " + Color::bold + p.flightNumber + Color::reset +
                  " (" + p.airline + ") from " + p.origin +
                  "  fuel=" + std::to_string(p.fuelLevel) + "%");
    }
    if (departs()) {
        Plane p = Plane::createDeparture(_nextPlaneId++, _clock);
        _airport.addDeparture(p);
        _logEvent(std::string(Color::magenta) + "+" + Color::reset +
                  " Departure " + Color::bold + p.flightNumber + Color::reset +
                  " (" + p.airline + ") to   " + p.destination);
    }
}

// ─── Event logging ────────────────────────────────────────────────────────────
void Simulation::_logEvent(const std::string& msg) {
    std::ostringstream oss;
    oss << Color::grey << "[" << mmss(_clock) << "] " << Color::reset << msg;
    _log.push_back(oss.str());
    if (_log.size() > 8) _log.erase(_log.begin());
}

void Simulation::_processCompleted() {
    for (const Plane& p : _airport.recentlyCompleted()) {
        if (p.fuelLevel == 0) {
            _logEvent(std::string(Color::red) + "CRASH " + Color::reset +
                      Color::bold + p.flightNumber + Color::reset +
                      " ran out of fuel in queue!");
        } else if (p.type == PlaneType::ARRIVING) {
            std::string fuel_note = p.isEmergency() ? " [EMERGENCY]" : "";
            _logEvent(std::string(Color::green) + "v" + Color::reset +
                      " Landed    " + Color::bold + p.flightNumber + Color::reset +
                      fuel_note + "  wait=" + std::to_string(p.waitTime()) + " min");
        } else {
            _logEvent(std::string(Color::yellow) + "^" + Color::reset +
                      " Departed  " + Color::bold + p.flightNumber + Color::reset +
                      "  wait=" + std::to_string(p.waitTime()) + " min");
        }
    }
    _justCompleted = _airport.recentlyCompleted();
    _airport.clearRecentlyCompleted();
}

// ─── Rendering ────────────────────────────────────────────────────────────────
void Simulation::_renderRunways() const {
    row(std::string(Color::bold) + "  RUNWAYS" + Color::reset);
    emptyRow();

    const auto& runways = _airport.runways();
    for (const auto& rw : runways) {
        std::ostringstream line;
        line << "  ";

        if (rw.isAvailable()) {
            line << Color::green << Color::bold << rw.name() << Color::reset
                 << "  " << Color::green << "CLEAR" << Color::reset
                 << "    — awaiting assignment";
        } else {
            const Plane& p = rw.currentPlane();
            const char*  op_color  = (rw.status() == RunwayStatus::LANDING)
                                     ? Color::cyan : Color::yellow;
            const char*  op_label  = (rw.status() == RunwayStatus::LANDING)
                                     ? "LANDING " : "TAKEOFF ";

            // Elapsed time on runway
            int elapsed = p.runwayDuration - rw.timeRemaining();

            line << Color::bold << rw.name() << Color::reset
                 << "  " << op_color << op_label << Color::reset
                 << Color::bold << p.flightNumber << Color::reset
                 << " (" << p.airline << ")"
                 << "  " << progressBar(elapsed, p.runwayDuration)
                 << "  " << Color::yellow << rw.timeRemaining() << " min" << Color::reset;

            if (p.type == PlaneType::ARRIVING) {
                line << "  fuel=" << fuelBar(p.fuelLevel);
                if (p.isEmergency())
                    line << Color::red << " EMERGENCY" << Color::reset;
            } else {
                line << "  to " << p.destination;
            }
        }
        row(line.str());
    }
}

void Simulation::_renderArrivalQueue() const {
    int sz = _airport.arrivalQueueSize();
    std::ostringstream header;
    header << "  " << Color::bold << Color::cyan << "ARRIVAL QUEUE"
           << Color::reset << "  (" << sz << " plane" << (sz != 1 ? "s" : "") << ")";
    row(header.str());
    emptyRow();

    if (sz == 0) {
        row("  " + std::string(Color::grey) + "  (empty)" + Color::reset);
        return;
    }

    int idx = 1;
    _airport.forEachArrival([&](const Plane& p) {
        std::ostringstream line;
        const char* urgency_color = p.isEmergency() ? Color::red
                                  : p.isLowFuel()   ? Color::yellow
                                  : Color::reset;
        const char* urgency_tag   = p.isEmergency() ? " EMRG"
                                  : p.isLowFuel()   ? " LOW "
                                  : "     ";

        line << "  " << std::setw(2) << idx++ << ".  "
             << urgency_color << urgency_tag << Color::reset << "  "
             << Color::bold << p.flightNumber << Color::reset
             << " (" << std::setw(9) << std::left << p.airline << ")"
             << "  " << p.origin << " → " << p.destination
             << "  fuel=" << fuelBar(p.fuelLevel) << " " << std::setw(3) << p.fuelLevel << "%";
        row(line.str());
    });
}

void Simulation::_renderDepartureQueue() const {
    int sz = _airport.departureQueueSize();
    std::ostringstream header;
    header << "  " << Color::bold << Color::magenta << "DEPARTURE QUEUE"
           << Color::reset << "  (" << sz << " plane" << (sz != 1 ? "s" : "") << ")";
    row(header.str());
    emptyRow();

    if (sz == 0) {
        row("  " + std::string(Color::grey) + "  (empty)" + Color::reset);
        return;
    }

    int idx = 1;
    _airport.forEachDeparture([&](const Plane& p) {
        std::ostringstream line;
        int waited = _clock - p.queueEntryTime;
        line << "  " << std::setw(2) << idx++ << ".       "
             << Color::bold << p.flightNumber << Color::reset
             << " (" << std::setw(9) << std::left << p.airline << ")"
             << "  " << p.origin << " → " << p.destination
             << "  waited=" << waited << " min";
        row(line.str());
    });
}

void Simulation::_renderStats() const {
    const Stats& s = _airport.stats();
    std::ostringstream line1, line2;

    line1 << "  Landed: "    << Color::green  << s.completedLandings  << Color::reset
          << "  Departed: "  << Color::yellow << s.completedTakeoffs  << Color::reset
          << "  Emergencies: " << Color::red  << s.emergenciesHandled << Color::reset
          << "  Crashes: "   << Color::red    << s.planesRejected     << Color::reset;

    line2 << "  In queue: arrivals=" << _airport.arrivalQueueSize()
          << " / departures=" << _airport.departureQueueSize()
          << "  Avg wait: " << Color::cyan
          << std::fixed << std::setprecision(1) << s.averageWait()
          << " min" << Color::reset
          << "  Max wait: " << s.maxWaitTime << " min";

    row(line1.str());
    row(line2.str());
}

void Simulation::_renderLog() const {
    row(std::string(Color::bold) + "  EVENT LOG" + Color::reset);
    emptyRow();
    if (_log.empty()) { row("  " + std::string(Color::grey) + "(no events yet)" + Color::reset); return; }
    for (const auto& entry : _log)
        row("  " + entry);
}

void Simulation::_render() const {
    // Clear screen
    std::cout << "\033[2J\033[H";

    // ── Header ──
    hline('+', '-', '+');
    std::ostringstream title;
    title << Color::bold << "  " << _airport.name()
          << Color::reset << "   Time: " << Color::cyan << mmss(_clock)
          << Color::reset << " / " << mmss(_cfg.duration)
          << "   Step: " << _clock << "/" << _cfg.duration;
    row(title.str());
    hline('+', '-', '+');

    // ── Runways ──
    emptyRow();
    _renderRunways();
    emptyRow();
    hline('+', '-', '+');

    // ── Queues ──
    emptyRow();
    _renderArrivalQueue();
    emptyRow();
    hline('+', '-', '+');
    emptyRow();
    _renderDepartureQueue();
    emptyRow();
    hline('+', '-', '+');

    // ── Stats ──
    emptyRow();
    row(std::string(Color::bold) + "  STATISTICS" + Color::reset);
    emptyRow();
    _renderStats();
    emptyRow();
    hline('+', '-', '+');

    // ── Log ──
    emptyRow();
    _renderLog();
    emptyRow();
    hline('+', '-', '+');
}

void Simulation::_renderFinal() const {
    const Stats& s = _airport.stats();
    std::cout << "\033[2J\033[H";

    hline('+', '=', '+');
    row(std::string(Color::bold) + Color::cyan + "  SIMULATION COMPLETE  —  " + _airport.name() + Color::reset);
    hline('+', '=', '+');
    emptyRow();
    row(std::string(Color::bold) + "  FINAL STATISTICS" + Color::reset);
    emptyRow();

    auto stat = [&](const std::string& label, int val, const char* color = Color::white) {
        std::ostringstream o;
        o << "    " << std::setw(30) << std::left << label
          << color << std::setw(6) << std::right << val << Color::reset;
        row(o.str());
    };
    auto statf = [&](const std::string& label, double val, const char* color = Color::white) {
        std::ostringstream o;
        o << "    " << std::setw(30) << std::left << label
          << color << std::setw(8) << std::right << std::fixed << std::setprecision(2) << val << Color::reset;
        row(o.str());
    };

    stat("Total arrivals queued:",   s.totalArrivals,      Color::cyan);
    stat("Total departures queued:", s.totalDepartures,    Color::magenta);
    stat("Successful landings:",     s.completedLandings,  Color::green);
    stat("Successful takeoffs:",     s.completedTakeoffs,  Color::yellow);
    stat("Emergency landings:",      s.emergenciesHandled, Color::red);
    stat("Planes lost (fuel out):",  s.planesRejected,     Color::red);
    emptyRow();
    statf("Average wait time (min):", s.averageWait(),     Color::cyan);
    stat("Maximum wait time (min):", s.maxWaitTime,        Color::yellow);
    emptyRow();

    int total = s.completedLandings + s.completedTakeoffs;
    int remaining = _airport.arrivalQueueSize() + _airport.departureQueueSize();
    stat("Total planes served:",     total,                Color::green);
    stat("Planes still in queue:",   remaining,            Color::yellow);
    emptyRow();
    hline('+', '=', '+');
    std::cout << '\n';
}

// ─── Main loop ────────────────────────────────────────────────────────────────
void Simulation::run() {
    std::srand(static_cast<unsigned>(std::time(nullptr)));

    std::cout << "\033[2J\033[H";
    std::cout << Color::bold << Color::cyan
              << "\n  Starting simulation: " << _cfg.name << "\n"
              << Color::reset;
    std::cout << "  Duration: " << _cfg.duration << " min"
              << "  |  Runways: " << _cfg.numRunways
              << "  |  Arrivals/10min: ~" << _cfg.arrivalRate
              << "  |  Departures/10min: ~" << _cfg.departureRate << "\n\n";

    if (!_cfg.fastMode) {
        std::cout << "  Press Enter to begin...";
        std::cin.ignore();
    }

    for (_clock = 0; _clock <= _cfg.duration; ++_clock) {
        // 1. Generate new traffic
        _generateTraffic();

        // 2. Advance the airport (burns fuel, ticks runways, assigns planes)
        _airport.step(_clock);

        // 3. Log completed planes
        _processCompleted();

        // 4. Render
        _render();

        // 5. Pause or wait
        if (_cfg.stepMode) {
            std::cout << "\n  [t=" << _clock << "]  Press Enter for next tick...";
            std::cin.ignore();
        } else if (!_cfg.fastMode) {
            std::this_thread::sleep_for(std::chrono::milliseconds(500));
        }
    }

    _renderFinal();
}

package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"runtime"
	"sync"

	"sentinel/er-service/matching"
)

type matchRequest struct {
	Objects       []matching.Object  `json:"objects"`
	LiveWeights   *matching.Weights  `json:"live_weights,omitempty"`
	ShadowWeights *matching.Weights  `json:"shadow_weights,omitempty"`
}

type matchResponse struct {
	Candidates []matching.Candidate `json:"candidates"`
}

func matchHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req matchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}

	liveW := matching.DefaultWeights()
	if req.LiveWeights != nil {
		liveW = *req.LiveWeights
	}

	objs := req.Objects
	n := len(objs)

	type pair struct{ i, j int }
	pairs := make([]pair, 0, n*(n-1)/2)
	for i := 0; i < n; i++ {
		for j := i + 1; j < n; j++ {
			if objs[i].Type == objs[j].Type {
				pairs = append(pairs, pair{i, j})
			}
		}
	}

	workers := runtime.NumCPU()
	results := make(chan *matching.Candidate, len(pairs))
	work := make(chan pair, len(pairs))

	var wg sync.WaitGroup
	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for p := range work {
				c := matching.CompareWithWeights(objs[p.i], objs[p.j], liveW)
				if c != nil {
					if req.ShadowWeights != nil {
						shadow := matching.CompareWithWeights(objs[p.i], objs[p.j], *req.ShadowWeights)
						if shadow != nil {
							c.ShadowConfidence = shadow.Confidence
						}
					}
					results <- c
				}
			}
		}()
	}

	for _, p := range pairs {
		work <- p
	}
	close(work)
	wg.Wait()
	close(results)

	candidates := make([]matching.Candidate, 0)
	seen := make(map[string]struct{})
	for c := range results {
		key := c.LeftID + ":" + c.RightID
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		candidates = append(candidates, *c)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(matchResponse{Candidates: candidates})
}

func weightsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(matching.DefaultWeights())
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"ok":true}`))
}

func main() {
	port := os.Getenv("ER_PORT")
	if port == "" {
		port = "3002"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/match", matchHandler)
	mux.HandleFunc("/weights", weightsHandler)
	mux.HandleFunc("/health", healthHandler)

	log.Printf("[er-service] listening on :%s with %d workers\n", port, runtime.NumCPU())
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}

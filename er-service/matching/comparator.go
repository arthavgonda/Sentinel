package matching

import (
	"math"
	"strings"
)

type Weights struct {
	UseLogistic bool               `json:"use_logistic"`
	Intercept   float64            `json:"intercept"`
	Coefs       map[string]float64 `json:"coefs"`
	JWHighThresh    float64 `json:"jw_high_thresh"`
	JWMedThresh     float64 `json:"jw_med_thresh"`
	OrgJWHighThresh float64 `json:"org_jw_high_thresh"`
	OrgJWMedThresh  float64 `json:"org_jw_med_thresh"`
	MinConfidence   float64 `json:"min_confidence"`
}

func DefaultWeights() Weights {
	return Weights{
		UseLogistic:     false,
		Intercept:       0,
		JWHighThresh:    0.95,
		JWMedThresh:     0.72,
		OrgJWHighThresh: 0.92,
		OrgJWMedThresh:  0.78,
		MinConfidence:   45,
		Coefs: map[string]float64{
			"jaro_winkler_high": 40, "jaro_winkler_med": 25,
			"soundex_match": 8, "exact_phone": 35,
			"partial_phone": 15, "same_city": 8, "alias_match": 12,
			"org_jw_high": 45, "org_jw_med": 22,
			"org_same_address": 25, "org_reg_id": 50,
		},
	}
}

type Object struct {
	ID         string            `json:"id"`
	Type       string            `json:"type"`
	Display    string            `json:"display"`
	Properties map[string]string `json:"properties"`
}

type Candidate struct {
	LeftID          string             `json:"left_id"`
	RightID         string             `json:"right_id"`
	Confidence      int                `json:"confidence"`
	ShadowConfidence int               `json:"shadow_confidence,omitempty"`
	Reasons         []string           `json:"reasons"`
	Features        map[string]float64 `json:"features"`
}

const phoneMinDigits = 6

func Compare(a, b Object) *Candidate {
	return CompareWithWeights(a, b, DefaultWeights())
}

func CompareWithWeights(a, b Object, w Weights) *Candidate {
	if a.Type != b.Type || a.ID == b.ID {
		return nil
	}
	switch a.Type {
	case "Person":
		return comparePerson(a, b, w)
	case "Organization":
		return compareOrganization(a, b, w)
	case "Phone":
		return comparePhone(a, b)
	case "Location":
		return compareLocation(a, b)
	default:
		return nil
	}
}

func comparePerson(a, b Object, w Weights) *Candidate {
	nameA := coalesce(a.Properties["Name"], a.Display)
	nameB := coalesce(b.Properties["Name"], b.Display)
	jw := JaroWinkler(nameA, nameB)

	sdxA := Soundex(firstName(nameA))
	sdxB := Soundex(firstName(nameB))
	soundex := 0.0
	if sdxA == sdxB && sdxA != "0000" {
		soundex = 1.0
	}

	phoneA := NormalizePhone(coalesce(a.Properties["Phone"], a.Properties["Number"], ""))
	phoneB := NormalizePhone(coalesce(b.Properties["Phone"], b.Properties["Number"], ""))
	exactPhone, partialPhone := 0.0, 0.0
	if len(phoneA) >= phoneMinDigits && len(phoneB) >= phoneMinDigits {
		if phoneA == phoneB {
			exactPhone = 1.0
		} else if phoneMatch(phoneA, phoneB) {
			partialPhone = 1.0
		}
	}

	cityA := strings.ToLower(strings.TrimSpace(a.Properties["City"]))
	cityB := strings.ToLower(strings.TrimSpace(b.Properties["City"]))
	sameCity := 0.0
	if cityA != "" && cityA == cityB {
		sameCity = 1.0
	}

	aliasA := strings.ToLower(a.Properties["Aliases"])
	aliasB := strings.ToLower(b.Properties["Aliases"])
	aliasMatch := 0.0
	if aliasA != "" && (strings.Contains(aliasA, strings.ToLower(nameB)) || strings.Contains(aliasB, strings.ToLower(nameA))) {
		aliasMatch = 1.0
	}

	features := map[string]float64{
		"jaro_winkler":  jw,
		"soundex_match": soundex,
		"exact_phone":   exactPhone,
		"partial_phone": partialPhone,
		"same_city":     sameCity,
		"alias_match":   aliasMatch,
	}

	var confidence int
	var reasons []string

	if w.UseLogistic {
		sum := w.Intercept
		sum += w.Coefs["jaro_winkler"] * jw
		sum += w.Coefs["soundex_match"] * soundex
		sum += w.Coefs["exact_phone"] * exactPhone
		sum += w.Coefs["partial_phone"] * partialPhone
		sum += w.Coefs["same_city"] * sameCity
		sum += w.Coefs["alias_match"] * aliasMatch
		prob := 1.0 / (1.0 + math.Exp(-sum))
		confidence = clamp(int(prob*100), 0, 100)
		reasons = personReasons(jw, soundex, exactPhone, partialPhone, sameCity, aliasMatch, w)
	} else {
		score := 0.0
		if jw >= w.JWHighThresh {
			score += w.Coefs["jaro_winkler_high"]
			reasons = append(reasons, "Exact name match (Jaro-Winkler "+fmtF(jw)+")")
		} else if jw >= w.JWMedThresh {
			score += w.Coefs["jaro_winkler_med"]
			reasons = append(reasons, "Similar name (Jaro-Winkler "+fmtF(jw)+")")
		}
		if soundex == 1.0 {
			score += w.Coefs["soundex_match"]
			reasons = append(reasons, "Phonetic name match (Soundex)")
		}
		if exactPhone == 1.0 {
			score += w.Coefs["exact_phone"]
			reasons = append(reasons, "Same phone (exact)")
		} else if partialPhone == 1.0 {
			score += w.Coefs["partial_phone"]
			reasons = append(reasons, "Same phone (partial match on digits present in both)")
		}
		if sameCity == 1.0 {
			score += w.Coefs["same_city"]
			reasons = append(reasons, "Same city")
		}
		if aliasMatch == 1.0 {
			score += w.Coefs["alias_match"]
			reasons = append(reasons, "Name appears in aliases")
		}
		confidence = clamp(int(score), 0, 100)
	}

	minConf := w.MinConfidence
	if minConf == 0 {
		minConf = 45
	}
	if float64(confidence) < minConf || len(reasons) == 0 {
		return nil
	}
	return &Candidate{LeftID: a.ID, RightID: b.ID, Confidence: confidence, Reasons: reasons, Features: features}
}

func personReasons(jw, soundex, exactPhone, partialPhone, sameCity, aliasMatch float64, w Weights) []string {
	var r []string
	if jw >= w.JWHighThresh {
		r = append(r, "Exact name match (Jaro-Winkler "+fmtF(jw)+")")
	} else if jw >= w.JWMedThresh {
		r = append(r, "Similar name (Jaro-Winkler "+fmtF(jw)+")")
	}
	if soundex == 1.0 {
		r = append(r, "Phonetic name match (Soundex)")
	}
	if exactPhone == 1.0 {
		r = append(r, "Same phone (exact)")
	} else if partialPhone == 1.0 {
		r = append(r, "Same phone (partial match on digits present in both)")
	}
	if sameCity == 1.0 {
		r = append(r, "Same city")
	}
	if aliasMatch == 1.0 {
		r = append(r, "Name appears in aliases")
	}
	return r
}

func compareOrganization(a, b Object, w Weights) *Candidate {
	nameA := coalesce(a.Properties["Name"], a.Display)
	nameB := coalesce(b.Properties["Name"], b.Display)
	jw := JaroWinkler(nameA, nameB)

	highThresh := w.OrgJWHighThresh
	if highThresh == 0 {
		highThresh = 0.92
	}
	medThresh := w.OrgJWMedThresh
	if medThresh == 0 {
		medThresh = 0.78
	}

	jwHigh := 0.0
	jwMed := 0.0
	if jw >= highThresh {
		jwHigh = 1.0
	} else if jw >= medThresh {
		jwMed = 1.0
	}

	addrA := strings.ToLower(strings.TrimSpace(a.Properties["Address"]))
	addrB := strings.ToLower(strings.TrimSpace(b.Properties["Address"]))
	sameAddr := 0.0
	if addrA != "" && addrA == addrB {
		sameAddr = 1.0
	}

	regA := strings.TrimSpace(a.Properties["Registration ID"])
	regB := strings.TrimSpace(b.Properties["Registration ID"])
	regID := 0.0
	if regA != "" && regA == regB {
		regID = 1.0
	}

	features := map[string]float64{
		"org_jw_high":      jwHigh,
		"org_jw_med":       jwMed,
		"org_same_address": sameAddr,
		"org_reg_id":       regID,
	}

	var confidence int
	var reasons []string

	if w.UseLogistic {
		sum := w.Intercept
		sum += w.Coefs["org_jw_high"] * jwHigh
		sum += w.Coefs["org_jw_med"] * jwMed
		sum += w.Coefs["org_same_address"] * sameAddr
		sum += w.Coefs["org_reg_id"] * regID
		prob := 1.0 / (1.0 + math.Exp(-sum))
		confidence = clamp(int(prob*100), 0, 100)
		reasons = orgReasons(jw, jwHigh, jwMed, sameAddr, regID, highThresh, medThresh)
	} else {
		score := 0.0
		if jwHigh == 1.0 {
			score += w.Coefs["org_jw_high"]
			reasons = append(reasons, "Near-identical organization name (Jaro-Winkler "+fmtF(jw)+")")
		} else if jwMed == 1.0 {
			score += w.Coefs["org_jw_med"]
			reasons = append(reasons, "Similar organization name (Jaro-Winkler "+fmtF(jw)+")")
		}
		if sameAddr == 1.0 {
			score += w.Coefs["org_same_address"]
			reasons = append(reasons, "Same registered address")
		}
		if regID == 1.0 {
			score += w.Coefs["org_reg_id"]
			reasons = append(reasons, "Same registration ID")
		}
		confidence = clamp(int(score), 0, 100)
	}

	minConf := w.MinConfidence
	if minConf == 0 {
		minConf = 45
	}
	if float64(confidence) < minConf || len(reasons) == 0 {
		return nil
	}
	return &Candidate{LeftID: a.ID, RightID: b.ID, Confidence: confidence, Reasons: reasons, Features: features}
}

func orgReasons(jw, jwHigh, jwMed, sameAddr, regID, highThresh, medThresh float64) []string {
	var r []string
	if jwHigh == 1.0 {
		r = append(r, "Near-identical organization name (Jaro-Winkler "+fmtF(jw)+")")
	} else if jwMed == 1.0 {
		r = append(r, "Similar organization name (Jaro-Winkler "+fmtF(jw)+")")
	}
	if sameAddr == 1.0 {
		r = append(r, "Same registered address")
	}
	if regID == 1.0 {
		r = append(r, "Same registration ID")
	}
	return r
}

func comparePhone(a, b Object) *Candidate {
	numA := NormalizePhone(coalesce(a.Properties["Number"], a.Display))
	numB := NormalizePhone(coalesce(b.Properties["Number"], b.Display))
	if len(numA) < phoneMinDigits || len(numB) < phoneMinDigits {
		return nil
	}
	features := map[string]float64{}
	if numA == numB {
		features["exact_phone"] = 1.0
		return &Candidate{LeftID: a.ID, RightID: b.ID, Confidence: 99, Reasons: []string{"Identical phone number"}, Features: features}
	}
	if phoneMatch(numA, numB) {
		features["partial_phone"] = 1.0
		return &Candidate{LeftID: a.ID, RightID: b.ID, Confidence: 58, Reasons: []string{"Partial phone number match"}, Features: features}
	}
	return nil
}

func compareLocation(a, b Object) *Candidate {
	addrA := strings.ToLower(strings.TrimSpace(coalesce(a.Properties["Address"], a.Display)))
	addrB := strings.ToLower(strings.TrimSpace(coalesce(b.Properties["Address"], b.Display)))
	jw := JaroWinkler(addrA, addrB)
	if jw >= 0.9 {
		features := map[string]float64{"jaro_winkler": jw}
		return &Candidate{LeftID: a.ID, RightID: b.ID, Confidence: clamp(int(jw*100), 0, 100), Reasons: []string{"Near-identical address (Jaro-Winkler " + fmtF(jw) + ")"}, Features: features}
	}
	return nil
}

func phoneMatch(a, b string) bool {
	shorter, longer := a, b
	if len(a) > len(b) {
		shorter, longer = b, a
	}
	if len(shorter) < phoneMinDigits {
		return false
	}
	return strings.HasSuffix(longer, shorter)
}

func firstName(name string) string {
	parts := strings.Fields(name)
	if len(parts) == 0 {
		return name
	}
	return parts[0]
}

func coalesce(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

func clamp(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

func fmtF(f float64) string {
	i := int(math.Round(f * 100))
	whole := i / 100
	frac := i % 100
	fs := ""
	if frac < 10 {
		fs = "0"
	}
	fs += itoa(frac)
	return itoa(whole) + "." + fs
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	buf := make([]byte, 0, 10)
	for n > 0 {
		buf = append([]byte{byte('0' + n%10)}, buf...)
		n /= 10
	}
	return string(buf)
}

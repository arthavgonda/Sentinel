package matching

import (
	"strings"
	"unicode"
)

func JaroWinkler(a, b string) float64 {
	a = strings.ToLower(strings.TrimSpace(a))
	b = strings.ToLower(strings.TrimSpace(b))
	if a == b {
		return 1.0
	}
	if len(a) == 0 || len(b) == 0 {
		return 0.0
	}

	matchDist := imax(len(a), len(b))/2 - 1
	if matchDist < 0 {
		matchDist = 0
	}

	aMatched := make([]bool, len(a))
	bMatched := make([]bool, len(b))

	matches := 0
	transpositions := 0

	for i, ca := range []rune(a) {
		lo := imax(0, i-matchDist)
		hi := imin(len(b)-1, i+matchDist)
		for j := lo; j <= hi; j++ {
			if bMatched[j] {
				continue
			}
			if []rune(b)[j] != ca {
				continue
			}
			aMatched[i] = true
			bMatched[j] = true
			matches++
			break
		}
	}

	if matches == 0 {
		return 0.0
	}

	aRunes := []rune(a)
	bRunes := []rune(b)
	k := 0
	for i := range aRunes {
		if !aMatched[i] {
			continue
		}
		for !bMatched[k] {
			k++
		}
		if aRunes[i] != bRunes[k] {
			transpositions++
		}
		k++
	}

	jaro := (float64(matches)/float64(len(aRunes)) +
		float64(matches)/float64(len(bRunes)) +
		float64(matches-transpositions/2)/float64(matches)) / 3.0

	prefix := 0
	maxPrefix := imin(4, imin(len(aRunes), len(bRunes)))
	for i := 0; i < maxPrefix; i++ {
		if aRunes[i] == bRunes[i] {
			prefix++
		} else {
			break
		}
	}

	return jaro + float64(prefix)*0.1*(1.0-jaro)
}

func Soundex(s string) string {
	s = strings.ToUpper(strings.TrimSpace(s))
	if len(s) == 0 {
		return "0000"
	}

	table := map[rune]byte{
		'B': '1', 'F': '1', 'P': '1', 'V': '1',
		'C': '2', 'G': '2', 'J': '2', 'K': '2', 'Q': '2', 'S': '2', 'X': '2', 'Z': '2',
		'D': '3', 'T': '3',
		'L': '4',
		'M': '5', 'N': '5',
		'R': '6',
	}

	runes := []rune(s)
	result := make([]byte, 0, 4)
	result = append(result, byte(runes[0]))

	prev := table[runes[0]]
	for _, r := range runes[1:] {
		if !unicode.IsLetter(r) {
			continue
		}
		code, ok := table[r]
		if !ok {
			prev = 0
			continue
		}
		if code == prev {
			continue
		}
		result = append(result, code)
		prev = code
		if len(result) == 4 {
			break
		}
	}
	for len(result) < 4 {
		result = append(result, '0')
	}
	return string(result)
}

func NormalizePhone(phone string) string {
	var sb strings.Builder
	for _, r := range phone {
		if unicode.IsDigit(r) {
			sb.WriteRune(r)
		}
	}
	return sb.String()
}

func imax(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func imin(a, b int) int {
	if a < b {
		return a
	}
	return b
}

package com.kiyo.app.autofill.detection

import android.app.assist.AssistStructure
import android.util.Log
import android.view.autofill.AutofillId
import com.kiyo.app.autofill.viewnode.ViewNodePredicate

/**
 * 필드 탐지기
 * ViewNode 트리를 순회하며 최적의 사용자명/비밀번호 필드 탐지
 */
object FieldDetector {

    private const val TAG = "FieldDetector"

    fun findFocusedNode(
        node: AssistStructure.ViewNode
    ): AssistStructure.ViewNode? {

        if (node.isFocused) {
            return node
        }

        for (i in 0 until node.childCount) {
            val child = node.getChildAt(i)

            val result = findFocusedNode(child)

            if (result != null) {
                return result
            }
        }

        return null
    }

    /**
     * 후위 순회(post-order traversal)로 최적의 필드 후보 찾기
     * 자식 노드를 먼저 평가한 후 현재 노드 평가
     * 
     * @param rootNode 루트 ViewNode
     * @param scoreCalculator 점수 계산 함수 (calculateUsernameScore 또는 calculatePasswordScore)
     * @return 최고 점수의 FieldCandidate 또는 null
     */
    fun findBestFieldCandidate(
        rootNode: AssistStructure.ViewNode,
        scoreCalculator: (AssistStructure.ViewNode) -> FieldCandidate?
    ): FieldCandidate? {
        // Use a mutable container to avoid smart cast issues in closure
        val bestCandidate = mutableListOf<FieldCandidate?>()
        bestCandidate.add(null)
        
        fun traverse(node: AssistStructure.ViewNode) {
            // First, traverse children (post-order: children before parent)
            for (i in 0 until node.childCount) {
                traverse(node.getChildAt(i))
            }
            
            // Then evaluate current node
            val candidate = scoreCalculator(node)
            if (candidate != null) {
                Log.d(TAG, "Candidate found: autofillId=${candidate.autofillId}, score=${candidate.score}, className=${candidate.className}, hints=[${candidate.autofillHints}], hint=${candidate.hint}, inputType=${candidate.inputType}, htmlInputType=${candidate.htmlInputType}, htmlAutocomplete=${candidate.htmlAutocomplete}, htmlName=${candidate.htmlName}, webDomain=${candidate.webDomain}, reason=${candidate.reason}")
                
                val currentBest = bestCandidate[0]
                if (currentBest == null || candidate.score > currentBest.score) {
                    bestCandidate[0] = candidate
                    Log.d(TAG, "New best candidate: autofillId=${candidate.autofillId}, score=${candidate.score}, reason=${candidate.reason}")
                } else if (candidate.score == currentBest.score) {
                    // Tie-breaker: prefer leaf nodes (more specific)
                    val currentIsLeaf = node.childCount == 0
                    val bestIsLeaf = currentBest.autofillId == candidate.autofillId // This is a simplification
                    if (currentIsLeaf && !bestIsLeaf) {
                        bestCandidate[0] = candidate
                        Log.d(TAG, "Tie-breaker: prefer leaf node, new best: autofillId=${candidate.autofillId}")
                    }
                }
            }
        }
        
        traverse(rootNode)
        return bestCandidate[0]
    }
    
    /**
     * 루트 노드에서 로그인 폼이 있는지 확인 (username + password 필드 모두 존재)
     * Samsung Internet 등에서 webDomain이 없을 때도 HTML 속성 기반으로 판단
     */
    fun hasLoginForm(rootNode: AssistStructure.ViewNode): Boolean {
        val usernameCandidate = findBestFieldCandidate(rootNode, FieldScorer::calculateUsernameScore)
        val passwordCandidate = findBestFieldCandidate(rootNode, FieldScorer::calculatePasswordScore)
        
        // Check if both username and password fields are detected
        val hasUsername = usernameCandidate != null
        val hasPassword = passwordCandidate != null
        
        // Also check if it's a known login domain (webDomain or HTML attributes)
        val isKnownLoginDomain = ViewNodePredicate.isKnownLoginDomain(rootNode)
        
        Log.d(TAG, "hasLoginForm: hasUsername=$hasUsername, hasPassword=$hasPassword, isKnownLoginDomain=$isKnownLoginDomain")
        
        return hasUsername && hasPassword
    }
}

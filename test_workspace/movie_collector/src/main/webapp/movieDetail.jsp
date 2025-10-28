<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ taglib uri="http://java.sun.com/jsp/jstl/core" prefix="c"%>
<%@ taglib uri="http://java.sun.com/jsp/jstl/functions" prefix="fn"%>
<%@ taglib prefix="fmt" uri="http://java.sun.com/jsp/jstl/fmt"%>
<%@ include file="nav_bar.jsp"%>
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Detail test</title>
</head>
<body>
	<center>
		<c:set var="userId" value="${sessionScope.userId}" />
		<img style="width: 600px; height: 800px;" src="${movie.posterSrc }">
		<hr />
		<h1>${movie.movieNm}</h1>
		<div style="padding-left: 50px;">
			<h3 align="left">감독 : ${movie.directors}</h3>
			<h3 align="left">
				개봉일 :
				<fmt:parseDate value="${movie.openDt}" pattern="yyyyMMdd" var="parsedDate" />
				<fmt:formatDate value="${parsedDate}" pattern="yyyy-MM-dd" />
				<%-- 				<c:choose> --%>
				<%-- 					<c:when test="${not empty movie.openDt and movie.openDt ne '-'}"> --%>
				<%-- 						<fmt:parseDate value="${movie.openDt}" pattern="yyyyMMdd" var="parsedDate" /> --%>
				<%-- 						<fmt:formatDate value="${parsedDate}" pattern="yyyy-MM-dd" /> --%>
				<%-- 					</c:when> --%>
				<%-- 					<c:otherwise> --%>
				<!-- 						- -->
				<%-- 					</c:otherwise> --%>
				<%-- 				</c:choose> --%>
			</h3>
			<h3 align="left">
				상영시간
				<c:choose>
					<c:when test="${movie.showTm >= 60}">
									${fn:substringBefore(movie.showTm div 60, '.')} 시간
									<c:if test="${movie.showTm mod 60 ne 0}">
									${(movie.showTm mod 60)}
									</c:if>
					</c:when>
					<c:otherwise>
									${movie.showTm}
								</c:otherwise>
				</c:choose>
				분
			</h3>
			<!-- 			<h3 align="left"> -->
			<!-- 				상영시간 : -->
			<%-- 				<c:choose> --%>
			<!-- 					값이 있고 '-'가 아닌 경우만 계산 -->
			<%-- 					<c:when test="${not empty movie.showTm and movie.showTm ne '-'}"> --%>
			<%-- 						<c:choose> --%>
			<%-- 							<c:when test="${movie.showTm >= 60}"> --%>
			<%-- 					${fn:substringBefore(movie.showTm div 60, '.')} 시간 --%>
			<%-- 					<c:if test="${movie.showTm mod 60 ne 0}"> --%>
			<%-- 						${movie.showTm mod 60} --%>
			<%-- 					</c:if> --%>
			<%-- 							</c:when> --%>
			<%-- 							<c:otherwise> --%>
			<%-- 					${movie.showTm} --%>
			<%-- 				</c:otherwise> --%>
			<%-- 						</c:choose> --%>
			<!-- 			분 -->
			<%-- 		</c:when> --%>

			<!-- 					값이 없거나 '-'인 경우 -->
			<%-- 					<c:otherwise> --%>
			<!-- 			- -->
			<%-- 		</c:otherwise> --%>
			<%-- 				</c:choose> --%>
			<!-- 			</h3> -->
			<h3 align="left">관람 등급 : ${movie.watchGradeNm}</h3>
			<h3 align="left">
				장르 :
				<c:forEach var="genre" items="${movie.genreAlt}" varStatus="i">${genre}<c:if test="${!i.last}">,</c:if>
				</c:forEach>
			</h3>
		</div>
		<hr />
		<!-- 		<form action="reviewController" method="post"> -->
		<form action="insertReview" method="post" accept-charset="UTF-8">
			<div class="radioContainer">
				<input type="radio" value="0" name="score" id="radio0">
				<label for="radio0">0 점</label>
				<input type="radio" value="1" name="score" id="radio1">
				<label for="radio1">1 점</label>
				<input type="radio" value="2" name="score" id="radio2">
				<label for="radio2">2 점</label>
				<input type="radio" value="3" name="score" id="radio3">
				<label for="radio3">3 점</label>
				<input type="radio" value="4" name="score" id="radio4">
				<label for="radio4">4 점</label>
				<input type="radio" value="5" name="score" id="radio5">
				<label for="radio5">5 점</label>
			</div>
			<div class="reviewTextContainer">
				<input type="text" name="review" id="review" placeholder="리뷰 내용을 입력하세요">
			</div>
			<div class="buttonContainer">
				<c:if test="${sessionScope.userId ne null}">
					<input type="hidden" name="movieCd" value="${movie.movieCd}" />
					<button type="submit">Write</button>
				</c:if>
			</div>
		</form>
		<hr />
		<div class="review list">
			<c:if test="${myReviewExist}">
				<div class="review line" style="display: flex; align-items: center; justify-content: center;">
					<p class="nickname" align="left" style="margin-right: 20px">${myrev.writer}</p>
					<p class="score_line" align="left" style="margin-right: 20px">${myrev.score}</p>
					<p class="review_line" align="left">${myrev.review}</p>
					<button type="button" onclick="confirmDelete(${myrev.review_seq})" style="margin-left: 20px; height: 20px">Delete</button>
				</div>
			</c:if>
			<c:forEach var="rev" items="${reviewList}">
				<div class="review line" style="display: flex; align-items: center; justify-content: center;">
					<p class="nickname" align="left" style="margin-right: 20px">${rev.writer}</p>
					<p class="score_line" align="left" style="margin-right: 20px">${rev.score}</p>
					<p class="review_line" align="left">${rev.review}</p>
				</div>
			</c:forEach>
		</div>
	</center>
</body>
<script type="text/javascript">
	function confirmDelete(reviewId) {
		if (confirm('정말로 이 리뷰를 삭제하시겠습니까?')) {
			location.href = 'delete.do?reviewId=' + reviewId;
		}
	}
	// URL 파라미터 읽기
	const urlParams = new URLSearchParams(window.location.search);
	const deleted = urlParams.get('deleted');

	// 삭제 완료 시 알림 표시
	if (deleted === 'true') {
		alert('리뷰가 성공적으로 삭제되었습니다.');
	}
</script>
</script>
</html>
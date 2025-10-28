<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ include file="nav_bar.jsp"%>
<%@ taglib uri="http://java.sun.com/jsp/jstl/functions" prefix="fn"%>
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>GC Movie Collector</title>
<script src="https://code.jquery.com/jquery-3.6.4.min.js"></script>
</head>

<body>
	<!-- 	<button onclick="location.href='test.do'">test</button> -->
	<div style="display: flex; justify-content: center; margin-top: 30px; gap: 10px;">
		<form action="movieSearch.do" method="get">
			<input type="text" name="movieName" size="60" placeholder="영화 제목을 입력하세요." />
			<input type="submit" value="조회">
		</form>
	</div>
	<c:if test="${empty movieData}">
		<h1>검색 결과가 없습니다.</h1>
	</c:if>
	<c:if test="${not empty movieData}">
		<div style="display: flex; flex-direction: column; align-items: center; margin-top: 30px;">
			<c:forEach var="movie" items="${movieData}">
				<a href="movieDetail.do?movieCd=${movie.movieCd}" style="text-decoration: none; color: inherit;">
					<div style="display: flex; width: 600px; margin-bottom: 30px; border: 1px solid #ccc; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);">
						<div style="flex: 1; background-color: #f0f0f0; display: flex; align-items: center; justify-content: center;">
							<img src="${movie.posterUrl}" alt="포스터" style="width: 100%; height: auto; object-fit: cover;">
							<%-- KMDB 허가 후 ${movie.posterUrl} 로 대체 예정 --%>
						</div>
						<div style="flex: 2; padding: 15px;">
							<p>
								<strong>영화명 :</strong>
								${movie.movieNm}
							</p>
							<p>
								<strong>제작년도 :</strong>
								${movie.prdtYear}
							</p>
							<p>
								<strong>유형 :</strong>
								${movie.typeNm}
							</p>
							<p>
								<strong>국가 :</strong>
								${movie.nationAlt}
							</p>
							<p>
								<strong>장르 :</strong>
								${movie.genreAlt}
							</p>
						</div>
					</div>
				</a>
			</c:forEach>
		</div>
	</c:if>
</body>
</html>
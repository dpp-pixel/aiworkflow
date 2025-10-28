<%@ page contentType="text/html; charset=UTF-8" %>
<%@ page import="model.Member" %>
<%
request.setCharacterEncoding("utf-8");
Member m = (Member) session.getAttribute("member");
if (m == null) {
    response.sendRedirect("login.jsp");
    return;
}
%>

<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>회원 탈퇴</title>
<link rel="stylesheet" href="./bootstrap-3.3.7-dist/css/bootstrap.min.css" />
<style>
body {
    font-family: 'Arial', sans-serif;
    background-color: #f7f7f7;
    height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
}
#container {
    width: 40%;
    background-color: #fff;
    padding: 30px;
    border-radius: 8px;
    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
    text-align: center;
}
h2 {
    margin-bottom: 20px;
}
p {
    margin-bottom: 30px;
    font-size: 16px;
}

/* 버튼 빨간색 */

button {
    width: 200px;
    padding: 12px;
    font-size: 16px;
    margin: 10px;
    border: none;
    border-radius: 6px;
    background-color: #dc3545;
    color: #fff;
    cursor: pointer;
    transition: background-color 0.3s;
}
button:hover {
    background-color: #a71d2a;
}
a {
    display: inline-block;
    margin-top: 20px;
    text-decoration: none;
    color: #007bff;
}
a:hover {
    text-decoration: underline;
}
</style>

<script type="text/javascript">
function confirmDelete() {
    const confirmed = confirm("탈퇴하시겠습니까?");
    if (confirmed) {
        document.getElementById("deleteForm").submit();
    } else {
        alert("취소되었습니다.");
        location.href = "mypage.jsp";
    }
}
</script>
</head>
<body>
<div id="container">
    <h2>회원 탈퇴</h2>
    <p><%= m.getNickname() %>님, 회원 탈퇴를 진행하시겠습니까?</p>

    <form id="deleteForm" action="DeleteMemberServlet.do" method="post">
        <button type="button" onclick="confirmDelete()">회원탈퇴</button>
    </form>

    <a href="mypage.jsp">돌아가기</a>
</div>
</body>
</html>
